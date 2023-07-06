export const getPrettyTime = (date) => {
  return date.toLocaleString("en-us", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
