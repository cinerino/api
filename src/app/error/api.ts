import { factory } from '@cinerino/domain';

/**
 * APIエラー
 */
export class APIError extends Error {
    public readonly code: number;
    public readonly errors: factory.errors.Chevre[];

    constructor(code: number, errors: factory.errors.Chevre[]) {
        const message = errors.map((error) => error.message)
            .join('\n');
        super(message);

        this.name = 'APIError';
        this.code = code;
        this.errors = errors;

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, APIError.prototype);
    }

    public toObject() {
        return {
            errors: this.errors.map((error) => {
                return {
                    ...error,
                    ...{ message: error.message }
                };
            }),
            code: this.code,
            message: this.message
        };
    }
}
