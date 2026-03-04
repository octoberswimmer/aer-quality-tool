#!/bin/bash
set -euo pipefail

copado -p "reading parameters"

json_or_empty() {
    local value="${1:-}"
    if [[ -z "${value}" ]]; then
        echo "{}"
        return
    fi

    if jq -e . >/dev/null 2>&1 <<<"${value}"; then
        echo "${value}"
        return
    fi

    # Some contexts pass JSON as an escaped string; parse if possible.
    if jq -e -R 'fromjson? | (type == "object" or type == "array")' >/dev/null 2>&1 <<<"${value}"; then
        jq -c -R 'fromjson' <<<"${value}"
        return
    fi

    echo "{}"
}

job_json=$(json_or_empty "${jobExecutionDataJson:-}")
branches_json=$(json_or_empty "${branchesAndFileIdJson:-}")

if [[ "${branches_json}" == "{}" && -n "${branchesAndFileIdJson:-}" ]]; then
    copado -p "invalid branchesAndFileIdJson; using fallbacks"
fi

originBranch=$(jq -r '
  .originBranch
  // .sourceBranch
  // .sourceBranchName
  // .branchName
  // empty
' <<<"${branches_json}" 2>/dev/null || true)

if [[ -z "${originBranch}" ]]; then
    originBranch=$(jq -r '
      .originBranch
      // .sourceBranch
      // .sourceBranchName
      // .branchName
      // empty
    ' <<<"${job_json}" 2>/dev/null || true)
fi

if [[ -z "${originBranch}" ]]; then
    copado -p "missing origin branch" -e "originBranch not found in branchesAndFileIdJson or jobExecutionDataJson"
    exit 1
fi

echo "param originBranch = ${originBranch}"

if [[ "${originBranch}" =~ ^promotion/.* ]] && [[ -n "${targetBranch:-}" ]] && [[ -z "${baseBranch:-}" ]]; then
    destinationBranch="${targetBranch}"
    echo "promotion context detected; using targetBranch"
elif [[ "${originBranch}" =~ ^feature/.* ]] && [[ -n "${baseBranch:-}" ]] && [[ -z "${targetBranch:-}" ]]; then
    destinationBranch="${baseBranch}"
    echo "feature context detected; using baseBranch"
else
    destinationBranch=$(jq -r '.destinationBranch // empty' <<<"${branches_json}" 2>/dev/null || true)
    if [[ -n "${destinationBranch}" ]]; then
        echo "fallback context; using destinationBranch from branchesAndFileIdJson"
    fi
fi

if [[ -z "${destinationBranch:-}" ]]; then
    destinationBranch=$(jq -r '
      .destinationBranch
      // .destinationBranchName
      // .targetBranch
      // .baseBranch
      // empty
    ' <<<"${job_json}" 2>/dev/null || true)
    if [[ -n "${destinationBranch}" ]]; then
        echo "fallback context; using destination branch from jobExecutionDataJson"
    fi
fi

if [[ -z "${destinationBranch:-}" ]]; then
    copado -p "missing destination branch" -e "destinationBranch not found in branchesAndFileIdJson or jobExecutionDataJson"
    exit 1
fi

echo "param destinationBranch = ${destinationBranch}"

copado -p "cloning repository"
copado-git-get "${destinationBranch}"
copado-git-get "${originBranch}"

config_json=$(jq -c '
  def parse(v):
    if (v|type) == "string" then
      (v | fromjson? // empty)
    elif (v|type) == "object" then
      v
    else
      empty
    end;

  parse(.aerConfig)
  // parse(.acceptanceCriteria)
  // parse(.acceptanceCriteriaJson)
  // parse(.extensionConfigurationAcceptanceCriteria)
  // parse(.extensionConfiguration.acceptanceCriteria)
  // parse(.testConfiguration)
  // {}
' <<<"${job_json}" 2>/dev/null || echo "{}")

config_source=$(jq -r '.source // .paths // empty' <<<"${config_json}" 2>/dev/null || true)
config_flags=$(jq -r '.flags // empty' <<<"${config_json}" 2>/dev/null || true)
config_default_ns=$(jq -r '.[\"default-namespace\"] // .defaultNamespace // empty' <<<"${config_json}" 2>/dev/null || true)
config_version=$(jq -r '.version // empty' <<<"${config_json}" 2>/dev/null || true)

source_value="${source:-${config_source:-force-app}}"
flags_value="${flags:-${config_flags:-}}"
default_ns_value="${defaultNamespace:-${config_default_ns:-}}"
version_value="${version:-${config_version:-latest}}"

source_value=$(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' <<<"${source_value}")
version_value=$(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' <<<"${version_value}")

if [[ -z "${source_value}" ]]; then
    echo "source cannot be empty" >&2
    exit 1
fi
if [[ -z "${version_value}" ]]; then
    version_value="latest"
fi

resolve_latest_version() {
    local repo="$1"

    local latest
    latest=$(curl -fsSL "https://api.github.com/repos/${repo}/releases/latest" | jq -r '.tag_name // empty' || true)
    if [[ -n "${latest}" && "${latest}" != "null" ]]; then
        echo "${latest}"
        return 0
    fi

    latest=$(curl -fsSL "https://api.github.com/repos/${repo}/releases?per_page=1" | jq -r '.[] | select(.draft == false) | .tag_name' | head -n 1 || true)
    if [[ -n "${latest}" && "${latest}" != "null" ]]; then
        echo "${latest}"
        return 0
    fi

    return 1
}

normalize_os() {
    case "$(uname -s | tr '[:upper:]' '[:lower:]')" in
        linux)
            echo "linux"
            ;;
        darwin)
            echo "darwin"
            ;;
        *)
            return 1
            ;;
    esac
}

normalize_arch() {
    case "$(uname -m)" in
        x86_64|amd64)
            echo "amd64"
            ;;
        aarch64|arm64)
            echo "arm64"
            ;;
        *)
            return 1
            ;;
    esac
}

install_aer() {
    local repo="$1"
    local version_tag="$2"

    local platform
    platform=$(normalize_os) || {
        echo "unsupported operating system: $(uname -s)" >&2
        return 1
    }

    local arch
    arch=$(normalize_arch) || {
        echo "unsupported architecture: $(uname -m)" >&2
        return 1
    }

    local temp_dir
    temp_dir=$(mktemp -d)

    local archive_name="aer_${platform}_${arch}_${version_tag}.zip"
    local download_url="https://github.com/${repo}/releases/download/${version_tag}/${archive_name}"
    local archive_path="${temp_dir}/${archive_name}"

    copado -p "downloading aer ${version_tag} (${platform}/${arch})"
    curl -fsSL "${download_url}" -o "${archive_path}"

    unzip -q "${archive_path}" -d "${temp_dir}"

    local candidate
    candidate=$(find "${temp_dir}" -type f -name aer | head -n 1)
    if [[ -z "${candidate}" ]]; then
        echo "aer binary not found in ${archive_name}" >&2
        return 1
    fi

    mkdir -p /tmp/aer-bin
    cp "${candidate}" /tmp/aer-bin/aer
    chmod +x /tmp/aer-bin/aer

    export PATH="/tmp/aer-bin:${PATH}"
}

release_repo="octoberswimmer/aer-dist"
if [[ "${version_value}" == "latest" ]]; then
    resolved_version=$(resolve_latest_version "${release_repo}") || {
        echo "unable to resolve latest aer version" >&2
        exit 1
    }
else
    resolved_version="${version_value}"
fi

echo "resolved aer version: ${resolved_version}"
install_aer "${release_repo}" "${resolved_version}"

if [[ -n "${aerLicenseKey:-}" ]]; then
    export AER_LICENSE_KEY="${aerLicenseKey}"
fi

aer license show

paths=()
while IFS= read -r line; do
    line=$(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' <<<"${line}")
    [[ -n "${line}" ]] && paths+=("${line}")
done <<<"${source_value}"

if [[ ${#paths[@]} -eq 1 && "${paths[0]}" == *" "* ]]; then
    IFS=' ' read -r -a paths <<<"${paths[0]}"
fi

if [[ ${#paths[@]} -eq 0 ]]; then
    echo "source cannot be empty" >&2
    exit 1
fi

junit_results="./aer-test-results.xml"
coverage_results="./aer-coverage.json"

ns_args=()
if [[ -n "${default_ns_value}" ]]; then
    ns_args+=(--default-namespace "${default_ns_value}")
fi

flag_args=()
if [[ -n "${flags_value}" ]]; then
    # shellcheck disable=SC2206
    flag_args=(${flags_value})
fi

aer_cmd=(aer test "${paths[@]}")
aer_cmd+=("${ns_args[@]}")
aer_cmd+=("${flag_args[@]}")
aer_cmd+=("--junit=${junit_results}" "--coverage=${coverage_results}")

copado -p "running aer test"
set +e
"${aer_cmd[@]}"
exit_code=$?
set -e

cat > ./aer-results-summary.json <<JSON
{
  "tool": "aer",
  "version": "${resolved_version}",
  "source": "${source_value}",
  "flags": "${flags_value}",
  "default-namespace": "${default_ns_value}",
  "exitCode": ${exit_code}
}
JSON

copado -p "uploading aer outputs"
if [[ -f "${junit_results}" ]]; then
    copado -u "${junit_results}"
fi
if [[ -f "${coverage_results}" ]]; then
    copado -u "${coverage_results}"
fi
if [[ -f "./aer-results-summary.json" ]]; then
    copado -u "./aer-results-summary.json"
fi

if [[ ${exit_code} -ne 0 ]]; then
    copado -p "aer test failed" -e "aer test exited with code ${exit_code}"
else
    copado -p "aer test completed"
fi

exit ${exit_code}
