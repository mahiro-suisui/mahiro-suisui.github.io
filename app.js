(function(){
  "use strict";

  const LETTERS = ["A","B","C","D","E","F","G","H"];

  const state = {
    selectedLectures: new Set(),
    countOption: "20",
    pool: [],       // built question pool for the session
    order: [],      // shuffled indices into pool
    current: 0,
    score: 0,
    answered: false,
    log: []         // {ok, q, lectureTitle, chosenText, correctText}
  };

  const el = (id) => document.getElementById(id);

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  // ---------- Screen 1: Lecture select ----------
  function renderLectureGrid(){
    const grid = el("lectureGrid");
    grid.innerHTML = "";
    QUIZ_DATA.forEach(lec=>{
      const card = document.createElement("div");
      card.className = "lecture-card";
      card.dataset.id = lec.id;
      card.innerHTML = `
        <div class="check"></div>
        <div class="num">第${lec.id}回</div>
        <div class="ttl">${lec.title.replace(/^第\d+回[：:]\s*/,"")}</div>
        <div class="cnt">${lec.questions.length}問収録</div>
      `;
      card.addEventListener("click", ()=>{
        if(state.selectedLectures.has(lec.id)){
          state.selectedLectures.delete(lec.id);
          card.classList.remove("selected");
        } else {
          state.selectedLectures.add(lec.id);
          card.classList.add("selected");
        }
        updateStartButton();
      });
      grid.appendChild(card);
    });
  }

  function updateStartButton(){
    el("btnStart").disabled = state.selectedLectures.size === 0;
    populateCountSelect();
  }

  function availableQuestionCount(){
    let n = 0;
    QUIZ_DATA.forEach(lec=>{
      if(state.selectedLectures.has(lec.id)) n += lec.questions.length;
    });
    return n;
  }

  function populateCountSelect(){
    const sel = el("countSelect");
    const max = availableQuestionCount();
    const opts = [10,20,30,50];
    sel.innerHTML = "";
    opts.filter(o=>o < max).forEach(o=>{
      const op = document.createElement("option");
      op.value = o; op.textContent = o+"問";
      sel.appendChild(op);
    });
    const allOp = document.createElement("option");
    allOp.value = "all";
    allOp.textContent = "全"+ (max||0) +"問";
    sel.appendChild(allOp);
    sel.value = "all";
  }

  el("btnSelectAll").addEventListener("click", ()=>{
    QUIZ_DATA.forEach(l=>state.selectedLectures.add(l.id));
    document.querySelectorAll(".lecture-card").forEach(c=>c.classList.add("selected"));
    updateStartButton();
  });
  el("btnSelectNone").addEventListener("click", ()=>{
    state.selectedLectures.clear();
    document.querySelectorAll(".lecture-card").forEach(c=>c.classList.remove("selected"));
    updateStartButton();
  });

  el("btnStart").addEventListener("click", startQuiz);
  el("btnRetrySame").addEventListener("click", startQuiz);
  el("btnBackToSelect").addEventListener("click", ()=> showScreen("screen-select"));

  function showScreen(id){
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    el(id).classList.add("active");
  }

  // ---------- Build pool & start ----------
  function buildPool(){
    const pool = [];
    QUIZ_DATA.forEach(lec=>{
      if(!state.selectedLectures.has(lec.id)) return;
      lec.questions.forEach(q=>{
        pool.push({
          lectureId: lec.id,
          lectureTitle: lec.title,
          q: q.q,
          choices: q.choices,
          explain: q.explain
        });
      });
    });
    return shuffle(pool);
  }

  function startQuiz(){
    const countVal = el("countSelect").value;
    let pool = buildPool();
    if(countVal !== "all"){
      const n = parseInt(countVal,10);
      pool = pool.slice(0, Math.min(n, pool.length));
    }
    state.pool = pool;
    state.current = 0;
    state.score = 0;
    state.log = [];
    state.answered = false;
    showScreen("screen-quiz");
    renderQuestion();
  }

  // ---------- Screen 2: Quiz ----------
  function renderQuestion(){
    state.answered = false;
    el("btnNext").style.display = "none";
    el("explainBox").classList.remove("show");

    const total = state.pool.length;
    const idx = state.current;
    const item = state.pool[idx];

    el("quizProgressText").textContent = `問題 ${idx+1} / ${total}`;
    el("quizScoreText").textContent = `正解 ${state.score}`;
    el("progressFill").style.width = ((idx)/total*100) + "%";
    el("qLectureTag").textContent = item.lectureTitle;
    el("qText").textContent = item.q;

    // shuffle choices, choices[0] of source data is always correct
    const shuffledIdx = shuffle(item.choices.map((_,i)=>i));
    const correctPos = shuffledIdx.indexOf(0);
    item._shuffledIdx = shuffledIdx;
    item._correctPos = correctPos;

    const box = el("choicesBox");
    box.innerHTML = "";
    shuffledIdx.forEach((origIdx, pos)=>{
      const div = document.createElement("div");
      div.className = "choice";
      div.dataset.pos = pos;
      div.innerHTML = `<div class="letter">${LETTERS[pos]}</div><div class="txt">${item.choices[origIdx]}</div>`;
      div.addEventListener("click", ()=> onChoose(pos, div));
      box.appendChild(div);
    });
  }

  function onChoose(pos, divEl){
    if(state.answered) return;
    state.answered = true;

    const idx = state.current;
    const item = state.pool[idx];
    const correctPos = item._correctPos;
    const isCorrect = pos === correctPos;
    if(isCorrect) state.score++;

    const allChoiceEls = Array.from(document.querySelectorAll(".choice"));
    allChoiceEls.forEach(c=>{
      c.classList.add("disabled");
      const p = parseInt(c.dataset.pos,10);
      if(p === correctPos) c.classList.add("correct");
      else if(p === pos) c.classList.add("wrong");
      else c.classList.add("faded");
    });

    const correctOrigIdx = item._shuffledIdx[correctPos];
    const chosenOrigIdx = item._shuffledIdx[pos];

    state.log.push({
      ok: isCorrect,
      q: item.q,
      lectureTitle: item.lectureTitle,
      chosenText: item.choices[chosenOrigIdx],
      correctText: item.choices[correctOrigIdx]
    });

    const verdict = el("verdictText");
    verdict.textContent = isCorrect ? "正解！" : "不正解";
    verdict.className = "verdict " + (isCorrect ? "ok" : "ng");
    el("quoteText").innerHTML = item.explain;
    el("explainBox").classList.add("show");

    el("quizScoreText").textContent = `正解 ${state.score}`;
    el("progressFill").style.width = ((idx+1)/state.pool.length*100) + "%";

    el("btnNext").style.display = "inline-block";
    el("btnNext").textContent = (idx+1 < state.pool.length) ? "次の問題へ" : "結果を見る";
  }

  el("btnNext").addEventListener("click", ()=>{
    if(state.current+1 < state.pool.length){
      state.current++;
      renderQuestion();
    } else {
      renderResult();
    }
  });

  // ---------- Screen 3: Result ----------
  function renderResult(){
    showScreen("screen-result");
    const total = state.pool.length;
    const pct = total ? Math.round(state.score/total*100) : 0;
    el("finalScore").textContent = `${state.score} / ${total}`;
    el("finalPct").textContent = pct + "%";

    const list = el("resultList");
    list.innerHTML = "";
    state.log.forEach((r,i)=>{
      const div = document.createElement("div");
      div.className = "result-item " + (r.ok ? "ok" : "ng");
      div.innerHTML = `
        <div class="mark">${r.ok ? "○" : "×"}</div>
        <div>
          <div class="qt">${i+1}. ${r.q}</div>
          <div class="meta">${r.lectureTitle}${r.ok ? "" : " ｜ 正解: " + r.correctText}</div>
        </div>
      `;
      list.appendChild(div);
    });
  }

  // ---------- init ----------
  renderLectureGrid();
  updateStartButton();
})();
