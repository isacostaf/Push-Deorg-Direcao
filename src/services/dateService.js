const TIME_ZONE = "America/Sao_Paulo";

function formatDateYmd(date = new Date(), timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);

  const map = Object.create(null);
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return `${map.year}-${map.month}-${map.day}`;
}

function formatDateDmyFromYmd(dateYmd) {
  const [year, month, day] = String(dateYmd || "").split("-");
  if (!year || !month || !day) {
    throw new Error("Data invalida para formatar.");
  }

  return `${day}/${month}/${year}`;
}

module.exports = {
  formatDateYmd,
  formatDateDmyFromYmd,
};
