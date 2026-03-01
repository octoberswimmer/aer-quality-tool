import { createElement } from 'lwc';
import aerConfiguration from 'c/aerConfiguration';

describe('c-aer-configuration', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('loads defaults', () => {
        const element = createElement('c-aer-configuration', {
            is: aerConfiguration
        });
        document.body.appendChild(element);

        expect(element.getValue()).toBe(
            JSON.stringify({
                source: 'force-app',
                flags: '',
                'default-namespace': '',
                version: 'latest'
            })
        );
    });

    it('validates empty source', () => {
        const element = createElement('c-aer-configuration', {
            is: aerConfiguration
        });
        element.value = JSON.stringify({
            source: '',
            flags: '',
            'default-namespace': '',
            version: 'latest'
        });
        document.body.appendChild(element);

        const result = element.validate();
        expect(result.isValid).toBe(false);
    });
});
