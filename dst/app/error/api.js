"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * APIError
 */
class APIError extends Error {
    constructor(code, errors) {
        const message = errors.map((error) => error.message).join('\n');
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.errors = errors;
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, APIError.prototype);
    }
    toObject() {
        return {
            errors: this.errors.map((error) => {
                return Object.assign({}, error, { message: error.message });
            }),
            code: this.code,
            message: this.message
        };
    }
}
exports.APIError = APIError;
