// `node-fetch` in a browser is just... fetch.
export default (...args) => window.fetch(...args)
export const Headers = window.Headers
export const Request = window.Request
export const Response = window.Response
