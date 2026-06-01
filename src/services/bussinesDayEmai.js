const axios = require("axios");
const { formatDateYmd } = require("./dateService");

const TIME_ZONE = "America/Sao_Paulo";
const feriadosCache = new Map();

async function obterFeriadosBrasil(ano) {
	const url = new URL(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
	const parsed = url.toString();

	const response = await axios.get(parsed, { timeout: 15000 });

	return response.data.map((item) => ({
		date: String(item.date || "").trim(),
		name: String(item.name || "").trim(),
		type: String(item.type || "").trim(),
	}));
}

function isFimDeSemana(date = new Date()) {
	const weekday = new Intl.DateTimeFormat("en-US", {
		weekday: "short",
		timeZone: TIME_ZONE,
	}).format(date);

	return weekday === "Sat" || weekday === "Sun";
}

function isFeriado(date, feriados = []) {
	const ymd = formatDateYmd(date);
	return feriados.some((item) => item.date === ymd);
}

function isDiaUtil(date, feriados = []) {
	if (isFimDeSemana(date)) {
		return false;
	}

	if (isFeriado(date, feriados)) {
		return false;
	}

	return true;
}

module.exports = {
	obterFeriadosBrasil,
	isFimDeSemana,
	isFeriado,
	isDiaUtil,
};
