/** Pure helpers for local, timezone-free note date/time values. */

export const pad2 = (value) => String(value).padStart(2, "0");

export const parseDateValue = (value) => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }
  return date;
};

export const toLocalDateTimeParts = (value, now = new Date()) => {
  const date = parseDateValue(value) || now;
  const datePart = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
  const timePart = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return {
    date: datePart,
    time: timePart,
    datetime: `${datePart}T${timePart}`,
  };
};

export const toLocalDateTimeValue = (date) => {
  const { datetime } = toLocalDateTimeParts("", date);
  return datetime;
};
