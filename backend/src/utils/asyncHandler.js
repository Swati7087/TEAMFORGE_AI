// Wraps an async controller so any thrown error / rejected promise
// is passed to next(err) automatically instead of needing try/catch
// in every single controller.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
