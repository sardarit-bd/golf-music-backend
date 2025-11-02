export const formatValidationErrors = (errorsArray) => {
  return errorsArray.map((err) => ({
    field: err.path,
    message: err.msg,
  }));
};