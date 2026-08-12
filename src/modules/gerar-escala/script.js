const people = [
  "João (Exemplo)",
  "Maria (Exemplo)",
  "Pedro (Exemplo)",
  "Ana (Exemplo)"
];

const personInput = document.getElementById("personInput");
const addPersonBtn = document.getElementById("addPersonBtn");
const peopleList = document.getElementById("peopleList");
const yearInput = document.getElementById("yearInput");
const perSundayInput = document.getElementById("perSundayInput");
const generateBtn = document.getElementById("generateBtn");
const output = document.getElementById("output");
const summary = document.getElementById("summary");

const currentYear = new Date().getFullYear();
yearInput.value = currentYear;
perSundayInput.value = 1;

function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function renderPeople() {
  peopleList.innerHTML = "";

  if (!people.length) {
    peopleList.innerHTML = '<li class="empty">Nenhuma pessoa adicionada.</li>';
    return;
  }

  people.forEach((person, index) => {
    const li = document.createElement("li");
    li.className = "person-item";

    const name = document.createElement("span");
    name.className = "person-name";
    name.textContent = person;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "small-btn edit";
    editBtn.title = "Editar nome";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", () => {
      const newName = prompt("Editar nome:", person);
      if (newName === null) return;
      const cleaned = normalizeName(newName);
      if (!cleaned) return;
      people[index] = cleaned;
      renderPeople();
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "small-btn remove";
    removeBtn.title = "Remover pessoa";
    removeBtn.textContent = "–";
    removeBtn.addEventListener("click", () => {
      people.splice(index, 1);
      renderPeople();
    });

    actions.append(editBtn, removeBtn);
    li.append(name, actions);
    peopleList.appendChild(li);
  });
}

function addPerson() {
  const value = normalizeName(personInput.value);
  if (!value) return;
  people.push(value);
  personInput.value = "";
  renderPeople();
}

function getSundays(year) {
  const sundays = [];
  const date = new Date(year, 0, 1);

  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1);
  }

  while (date.getFullYear() === year) {
    sundays.push(new Date(date));
    date.setDate(date.getDate() + 7);
  }

  return sundays;
}

function formatDate(date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  });
}

function quarterInfo(monthIndex) {
  if (monthIndex <= 2) return { title: "1º Trimestre", order: 1 };
  if (monthIndex <= 5) return { title: "2º Trimestre", order: 2 };
  if (monthIndex <= 8) return { title: "3º Trimestre", order: 3 };
  return { title: "4º Trimestre", order: 4 };
}

function countAppearances(assignments) {
  const counts = {};
  people.forEach(person => {
    counts[person] = 0;
  });

  assignments.forEach(({ assigned }) => {
    assigned.forEach(person => {
      counts[person] = (counts[person] || 0) + 1;
    });
  });

  return counts;
}

function generateScale() {
  output.innerHTML = "";

  if (people.length === 0) {
    summary.textContent = "Adicione pelo menos uma pessoa antes de gerar a escala.";
    return;
  }

  const perSunday = Math.max(1, parseInt(perSundayInput.value, 10) || 1);
  const year = parseInt(yearInput.value, 10);

  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    summary.textContent = "Informe um ano válido entre 1900 e 2100.";
    return;
  }

  const sundays = getSundays(year);
  if (!sundays.length) {
    summary.textContent = "Não foi possível encontrar domingos para o ano informado.";
    return;
  }

  const assignments = [];
  let cursor = 0;

  sundays.forEach(date => {
    const assigned = [];

    for (let i = 0; i < perSunday; i++) {
      assigned.push(people[cursor % people.length]);
      cursor += 1;
    }

    assignments.push({
      date,
      assigned,
      quarter: quarterInfo(date.getMonth())
    });
  });

  const groups = assignments.reduce((acc, item) => {
    const key = item.quarter.order;
    if (!acc[key]) {
      acc[key] = {
        title: item.quarter.title,
        lines: []
      };
    }
    acc[key].lines.push(`${formatDate(item.date)} – ${item.assigned.join(", ")}`);
    return acc;
  }, {});

  const totalAssignments = countAppearances(assignments);
  const grandTotal = Object.values(totalAssignments).reduce((sum, value) => sum + value, 0);

  summary.innerHTML = `Ano <strong>${year}</strong> • ${sundays.length} domingos • ${perSunday} pessoa(s) por domingo • ${grandTotal} participações no total`;

  [1, 2, 3, 4].forEach((index) => {
    const group = groups[index];
    if (!group) return;

    const quarterCard = document.createElement("article");
    quarterCard.className = "quarter";

    const header = document.createElement("div");
    header.className = "quarter-header";

    const title = document.createElement("h3");
    title.textContent = group.title;

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn secondary";
    copyBtn.textContent = "Copiar";
    copyBtn.addEventListener("click", async () => {
      const text = `${group.title}\n${group.lines.join("\n")}`;
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "Copiado";
        setTimeout(() => (copyBtn.textContent = "Copiar"), 1400);
      } catch {
        alert("Não foi possível copiar automaticamente. Selecione o texto manualmente.");
      }
    });

    header.append(title, copyBtn);

    const body = document.createElement("div");
    body.className = "quarter-body";
    body.textContent = group.lines.join("\n");

    quarterCard.append(header, body);
    output.appendChild(quarterCard);
  });

  const countsCard = document.createElement("article");
  countsCard.className = "quarter counts";

  const countsHeader = document.createElement("div");
  countsHeader.className = "quarter-header";

  const countsTitle = document.createElement("h3");
  countsTitle.textContent = "Participações por pessoa";

  countsHeader.appendChild(countsTitle);

  const countsBody = document.createElement("div");
  countsBody.className = "quarter-body";

  const countGrid = document.createElement("div");
  countGrid.className = "count-grid";

  Object.entries(totalAssignments)
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .forEach(([name, value]) => {
      const item = document.createElement("div");
      item.className = "count-item";
      item.innerHTML = `<strong>${name}</strong><span>${value} vez(es)</span>`;
      countGrid.appendChild(item);
    });

  countsBody.appendChild(countGrid);
  countsCard.append(countsHeader, countsBody);
  output.appendChild(countsCard);
}

addPersonBtn.addEventListener("click", addPerson);
personInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addPerson();
});
generateBtn.addEventListener("click", generateScale);

renderPeople();
