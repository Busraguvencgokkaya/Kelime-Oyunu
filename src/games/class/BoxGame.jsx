// Kutu Oyunu (Baamboozle tarzı): takımlar sırayla kutu seçer, soruyu sözlü cevaplar ya da sürpriz çıkar.
import { useMemo, useState } from 'react';
import { shuffle } from '../../lib/util.js';
import { sfx } from '../../lib/sound.js';
import { ClassBar, OralCard, Winner } from './shared.jsx';

const SURPRISES = {
  bomb: { icon: '💣', title: 'Bomba!', text: '10 puan kaybettin.' },
  steal: { icon: '🦊', title: 'Puan çal!', text: 'Bir takımdan 10 puan al. Hangi takım?' },
  double: { icon: '✨', title: '×2', text: 'Puanın 2 katına çıktı!' },
  swap: { icon: '🔄', title: 'Puanları değiştir!', text: 'Puanını bir takımla değiştir. Hangi takım?' },
  gift: { icon: '🎁', title: 'Hediye!', text: '15 puan kazandın!' },
};

function buildBoxes(cards, count) {
  const nSurprise = Math.max(2, Math.round(count * 0.2));
  const kinds = shuffle(['bomb', 'steal', 'double', 'swap', 'gift', 'gift', 'bomb', 'steal', 'double', 'swap']).slice(0, nSurprise);
  const pool = shuffle(cards);
  const boxes = [];
  for (let i = 0; i < count - nSurprise; i++) boxes.push({ type: 'q', card: pool[i % pool.length], points: Math.random() < 0.6 ? 10 : 20 });
  kinds.forEach((k) => boxes.push({ type: 's', kind: k }));
  return shuffle(boxes).map((b, i) => ({ ...b, n: i + 1 }));
}

export default function BoxGame({ title, cards, teams, boxCount, onExit }) {
  const [round, setRound] = useState(0);
  const boxes = useMemo(() => buildBoxes(cards, boxCount), [cards, boxCount, round]);
  const [opened, setOpened] = useState({});
  const [scores, setScores] = useState(() => teams.map(() => 0));
  const [turn, setTurn] = useState(0);
  const [active, setActive] = useState(null); // { box, revealed, done }
  const allOpen = Object.keys(opened).length >= boxes.length;

  const add = (i, d) => setScores((s) => s.map((v, k) => (k === i ? Math.max(0, v + d) : v)));
  const nextTurn = () => setTurn((t) => (t + 1) % teams.length);

  function open(box) {
    if (opened[box.n]) return;
    setOpened((o) => ({ ...o, [box.n]: true }));
    setActive({ box, revealed: false });
    box.type === 's' ? sfx.power() : sfx.click();
    if (box.type === 's') {
      if (box.kind === 'bomb') { add(turn, -10); sfx.wrong(); }
      if (box.kind === 'gift') add(turn, 15);
      if (box.kind === 'double') setScores((s) => s.map((v, k) => (k === turn ? Math.max(v * 2, 10) : v)));
    }
  }
  function close(correct) {
    const b = active.box;
    if (b.type === 'q' && correct) { add(turn, b.points); sfx.correct(); }
    if (b.type === 'q' && correct === false) sfx.wrong();
    setActive(null);
    nextTurn();
  }
  function target(k) {
    const b = active.box;
    if (b.kind === 'steal') {
      setScores((s) => { const take = Math.min(10, s[k]); return s.map((v, j) => (j === k ? v - take : j === turn ? v + take : v)); });
    }
    if (b.kind === 'swap') setScores((s) => s.map((v, j) => (j === k ? s[turn] : j === turn ? s[k] : v)));
    sfx.power();
    setActive(null);
    nextTurn();
  }
  function again() { setRound((r) => r + 1); setOpened({}); setScores(teams.map(() => 0)); setTurn(0); setActive(null); }

  const team = teams[turn];
  const b = active?.box;
  const needsTarget = b?.type === 's' && (b.kind === 'steal' || b.kind === 'swap');

  return (
    <div className="class-screen">
      <ClassBar title={title} onExit={onExit}>
        <span className="turn-pill" style={{ background: team.color }}>Sıra: {team.name}</span>
      </ClassBar>
      <div className="scoreboard">
        {teams.map((t, i) => (
          <div key={i} className={`team-score ${i === turn ? 'on' : ''}`} style={{ '--team': t.color }}>
            <span className="team-name">{t.name}</span>
            <strong>{scores[i]}</strong>
            <span className="team-adjust">
              <button onClick={() => add(i, -5)} aria-label={`${t.name} 5 puan eksilt`}>−5</button>
              <button onClick={() => add(i, 5)} aria-label={`${t.name} 5 puan ekle`}>+5</button>
            </span>
          </div>
        ))}
      </div>
      <div className={`box-grid n${boxes.length}`}>
        {boxes.map((box) => (
          <button key={box.n} className={`box ${opened[box.n] ? 'open' : ''}`} onClick={() => open(box)} disabled={!!opened[box.n] || !!active}>
            {opened[box.n] ? (box.type === 's' ? SURPRISES[box.kind].icon : '✓') : box.n}
          </button>
        ))}
      </div>

      {active && (
        <div className="class-modal">
          <div className="class-card" style={{ '--team': team.color }}>
            <div className="class-card-head">
              <span className="turn-pill" style={{ background: team.color }}>{team.name}</span>
              <span>Kutu {b.n}{b.type === 'q' ? `, ${b.points} puan` : ''}</span>
            </div>
            {b.type === 'q' ? (
              <>
                <OralCard card={b.card} revealed={active.revealed} />
                <div className="row center">
                  {!active.revealed && <button className="btn btn-sun btn-lg" onClick={() => setActive({ ...active, revealed: true })}>Cevabı göster</button>}
                  <button className="btn btn-correct btn-lg" onClick={() => close(true)}>✓ Doğru</button>
                  <button className="btn btn-wrong btn-lg" onClick={() => close(false)}>✗ Yanlış</button>
                </div>
              </>
            ) : (
              <div className="surprise">
                <div className="surprise-icon">{SURPRISES[b.kind].icon}</div>
                <h2>{SURPRISES[b.kind].title}</h2>
                <p>{SURPRISES[b.kind].text}</p>
                {needsTarget ? (
                  <div className="row center">
                    {teams.map((t, k) => k !== turn && (
                      <button key={k} className="btn btn-lg team-btn" style={{ background: t.color }} onClick={() => target(k)}>{t.name} ({scores[k]})</button>
                    ))}
                  </div>
                ) : (
                  <button className="btn btn-sun btn-lg" onClick={() => close(null)}>Devam</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {allOpen && !active && (
        <div className="class-modal"><Winner teams={teams} scores={scores} onAgain={again} onExit={onExit} /></div>
      )}
    </div>
  );
}
