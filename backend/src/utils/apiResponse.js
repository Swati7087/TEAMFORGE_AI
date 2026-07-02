export function success(res, statusCode, data, message = "OK") {
  return res.status(statusCode).json({ success: true, message, data });
}

export function failure(res, statusCode, message = "Something went wrong") {
  return res.status(statusCode).json({ success: false, message });
}
