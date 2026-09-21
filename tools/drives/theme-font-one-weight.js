// Saves Notebook the way /themes does, with one Google Fonts request per family, then opens a
// widget page in a frame and checks its one-weight face (Architects Daughter) actually renders.
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const item = await (await fetch('https://tweakcn.com/r/themes/notebook.json')).json();
const named = (block) => Object.fromEntries(Object.entries(block ?? {}).map(([k, v]) => [`--${k}`, v]));
const shared = named(item.cssVars.theme);
const light = { ...shared, ...named(item.cssVars.light) };
const { '--radius': _r, ...dark } = { ...shared, ...named(item.cssVars.dark) };
const body = (t) => Object.entries(t).map(([k, v]) => `  ${k}: ${v};`).join('\n');
const css = `.sg-demo[data-theme='custom'],\n:root[data-sg-palette='custom'] {\n${body(light)}\n}\n\n.sg-demo[data-theme='custom'].dark,\n:root[data-sg-palette='custom'][data-theme='dark'] {\n${body(dark)}\n}`;
// The request string as src/theme/fonts.ts now writes it: plain then weighted, per family.
const families = ['Architects Daughter'];
const fonts = families.flatMap((f) => [`https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}&display=swap`, `https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`]).join(' ');
localStorage.setItem('sg-theme:custom', JSON.stringify({ label: 'Notebook', css, fonts, theme: { light, dark } }));
localStorage.setItem('sg-demo:palette', 'custom');
const frame = document.createElement('iframe');
frame.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:800px;opacity:0.01';
document.body.append(frame);
await new Promise((resolve) => { frame.onload = resolve; frame.src = '/widgets/entity-picker/'; });
const doc = frame.contentDocument;
await doc.fonts.ready;
for (let t = 0; t < 40 && !doc.fonts.check('16px "Architects Daughter"'); t++) { await doc.fonts.load('16px "Architects Daughter"').catch(() => {}); await pause(250); }
const links = [...doc.querySelectorAll('link[id^="sg-theme-fonts"]')].map((l) => l.href);
const width = (family) => { const s = doc.createElement('span'); s.style.cssText = `position:absolute;font-size:32px;font-family:${family}`; s.textContent = 'Architects Daughter measures itself'; doc.body.append(s); const w = s.getBoundingClientRect().width; s.remove(); return w; };
const named_ = width('"Architects Daughter", sans-serif'), plain = width('sans-serif');
const stage = doc.querySelector('[data-stage]');
const stageFamily = stage ? getComputedStyle(stage).fontFamily : 'no stage';
const loaded = doc.fonts.check('16px "Architects Daughter"');
frame.remove();
localStorage.removeItem('sg-theme:custom'); localStorage.removeItem('sg-demo:palette');
const ok = loaded && Math.abs(named_ - plain) > 4 && links.length === 2;
return { verdict: (ok ? 'PASS ' : 'FAIL ') + `Notebook's one-weight face renders on a widget page: loaded ${loaded}, width ${named_.toFixed(1)} vs ${plain.toFixed(1)}, ${links.length} font links, stage ${stageFamily}` };
