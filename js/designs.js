/* Design templates + color schemes, shared by the Preaching page and the Hymnals page.
 *   SBVC.designs.THEMES / SCHEMES         the 30 designs and 21 color schemes
 *   SBVC.designs.colors(design, scheme, custom)   the six colors in use: the design's own, a scheme, or your custom ones
 *   SBVC.designs.resolve(design, colors)  design + colors, ready to paint: {bg, css, title:{color,font}, body:{color,font}, accent, accent2}
 */
(function () {
  'use strict';
  var S = window.SBVC;

  // A design = a background shape (CSS with {bg} {bg2} {ac} {ac2} for its colors) + heading/body fonts + its own six colors.
  // Colors c = [background, background 2, heading, body text, accent, accent 2]
  function T(id, name, shape, dark, c, tf, bf) {
    return { id: id, name: name, shape: shape, dark: dark, c: { bg: c[0], bg2: c[1], title: c[2], body: c[3], ac: c[4], ac2: c[5] }, title: { font: tf }, body: { font: bf } };
  }
  function fill(shape, c) {
    return shape.replace(/\{bg2\}/g, c.bg2).replace(/\{bg\}/g, c.bg).replace(/\{ac2\}/g, c.ac2).replace(/\{ac\}/g, c.ac);
  }
  var BAND = function (at) { return 'linear-gradient(to bottom, transparent ' + at + '%, {ac} ' + at + '%)'; };
  var THEMES = [
    T('office-light', 'Office Light', '', false, ['#FFFFFF', '#FFFFFF', '#1F2937', '#374151', '#2563EB', '#F59E0B'], 'Inter', 'Inter'),
    T('office-dark', 'Office Dark (SBVC)', '', true, ['#000000', '#000000', '#D4A373', '#F5EBDD', '#D4A373', '#FACC15'], 'Inter', 'Inter'),
    T('sky-corner', 'Sky Corner', 'linear-gradient(135deg, transparent 64%, {ac} 64%, {ac} 84%, {ac2} 84%)', false, ['#FFFFFF', '#FFFFFF', '#111827', '#374151', '#38BDF8', '#F97316'], 'Montserrat', 'Montserrat'),
    T('slate-mist', 'Slate Mist', 'linear-gradient(160deg, {bg2}, {bg})', true, ['#374151', '#6B7280', '#F3F4F6', '#E5E7EB', '#FCD34D', '#F59E0B'], 'Raleway', 'Raleway'),
    T('warm-paper', 'Warm Paper', BAND(92), false, ['#FAF3E8', '#F0E2CC', '#7C2D12', '#44403C', '#C2410C', '#F59E0B'], 'Playfair Display', 'Lato'),
    T('olive-garden', 'Olive Garden', 'linear-gradient(90deg, transparent 88%, {ac2} 88%, {ac2} 94%, {ac} 94%)', false, ['#F7F7E8', '#ECECD0', '#365314', '#3F3F46', '#4D7C0F', '#84CC16'], 'Merriweather', 'Open Sans'),
    T('midnight', 'Midnight', 'radial-gradient(circle at 70% 20%, {bg2}, {bg} 70%)', true, ['#020617', '#1E3A8A', '#FFFFFF', '#CBD5E1', '#FBBF24', '#38BDF8'], 'Montserrat', 'Open Sans'),
    T('black-gold', 'Black Gold', BAND(94), true, ['#0A0A0A', '#1C1917', '#D4A373', '#F5EBDD', '#D4A373', '#FACC15'], 'Playfair Display', 'Inter'),
    T('ocean', 'Ocean', 'linear-gradient(135deg, {bg2}, {bg})', true, ['#1E3A8A', '#0EA5E9', '#FFFFFF', '#E0F2FE', '#FDE68A', '#38BDF8'], 'Ubuntu', 'Ubuntu'),
    T('teal-deep', 'Deep Teal', 'linear-gradient(160deg, {bg2}, {bg})', true, ['#134E4A', '#0F766E', '#F0FDFA', '#CCFBF1', '#FCD34D', '#2DD4BF'], 'Lato', 'Lato'),
    T('crimson', 'Crimson', 'linear-gradient(to bottom, {bg2}, {bg})', true, ['#450A0A', '#991B1B', '#FEF2F2', '#FECACA', '#FCD34D', '#F87171'], 'Playfair Display', 'Open Sans'),
    T('royal-purple', 'Royal Purple', 'linear-gradient(135deg, {bg2}, {bg})', true, ['#1E1B4B', '#6D28D9', '#FFFFFF', '#E9D5FF', '#FDE047', '#C084FC'], 'Raleway', 'Raleway'),
    T('sunrise', 'Sunrise', 'linear-gradient(180deg, {bg2}, {ac2} 55%, {bg})', true, ['#9A3412', '#FDBA74', '#FFFFFF', '#FFEDD5', '#451A03', '#F97316'], 'Oswald', 'Open Sans'),
    T('forest', 'Forest', 'linear-gradient(160deg, {bg2}, {bg})', true, ['#052E16', '#166534', '#ECFCCB', '#D9F99D', '#FDE68A', '#86EFAC'], 'Merriweather', 'Noto Sans'),
    T('red-banner', 'Red Banner', 'linear-gradient(to bottom, {ac} 8%, transparent 8%)', false, ['#FFFFFF', '#FFFFFF', '#111827', '#374151', '#B91C1C', '#F59E0B'], 'Inter', 'Inter'),
    T('bold-edge', 'Bold Edge', 'linear-gradient(90deg, transparent 94%, {ac} 94%)', false, ['#FFFFFF', '#F3F4F6', '#111827', '#404040', '#C2410C', '#F59E0B'], 'Oswald', 'Open Sans'),
    T('soft-blue', 'Soft Blue', 'linear-gradient(160deg, {bg}, {bg2})', false, ['#FFFFFF', '#DBEAFE', '#1E3A8A', '#334155', '#2563EB', '#38BDF8'], 'Lato', 'Lato'),
    T('lavender', 'Lavender', 'linear-gradient(160deg, {bg}, {bg2})', false, ['#FFFFFF', '#EDE9FE', '#5B21B6', '#3F3F46', '#7C3AED', '#C084FC'], 'Raleway', 'Open Sans'),
    T('rose', 'Rose', 'linear-gradient(160deg, {bg}, {bg2})', false, ['#FFF1F2', '#FECDD3', '#9F1239', '#44403C', '#E11D48', '#FB7185'], 'Playfair Display', 'Lato'),
    T('mint', 'Mint', 'linear-gradient(160deg, {bg}, {bg2})', false, ['#F0FDF4', '#BBF7D0', '#14532D', '#374151', '#16A34A', '#4ADE80'], 'Open Sans', 'Open Sans'),
    T('sand', 'Sand', 'linear-gradient(to bottom, {bg}, {bg2})', false, ['#F5EBDD', '#E7D3B7', '#78350F', '#57534E', '#B45309', '#D97706'], 'Georgia', 'Inter'),
    T('charcoal', 'Charcoal', 'linear-gradient(160deg, {bg2}, {bg})', true, ['#18181B', '#3F3F46', '#FFFFFF', '#D4D4D8', '#F59E0B', '#FBBF24'], 'Roboto', 'Roboto'),
    T('steel', 'Steel Blue', 'linear-gradient(135deg, {bg2}, {bg})', true, ['#0F172A', '#334155', '#E2E8F0', '#CBD5E1', '#38BDF8', '#818CF8'], 'Noto Sans', 'Noto Sans'),
    T('neon', 'Neon Night', 'linear-gradient(to bottom, transparent 94%, {ac} 94%, {ac} 97%, {ac2} 97%)', true, ['#030712', '#111827', '#FFFFFF', '#D1D5DB', '#22D3EE', '#EC4899'], 'Montserrat', 'Inter'),
    T('amber', 'Amber', 'linear-gradient(135deg, {bg2}, {bg} 70%)', true, ['#1C1917', '#78350F', '#FDE68A', '#FEF3C7', '#F59E0B', '#FBBF24'], 'Merriweather', 'Lato'),
    T('chalkboard', 'Chalkboard', 'radial-gradient(circle at 50% 40%, {bg2}, {bg})', true, ['#14281D', '#2F5D43', '#F5F5F4', '#E7E5E4', '#FDE68A', '#86EFAC'], 'Ubuntu', 'Ubuntu'),
    T('burgundy', 'Burgundy Gold', 'linear-gradient(135deg, {bg2}, {bg})', true, ['#2A0A18', '#581C34', '#F5D0A9', '#FCE7F3', '#F5D0A9', '#E9B872'], 'Playfair Display', 'Open Sans'),
    T('graphite-red', 'Graphite Red', 'linear-gradient(90deg, {ac2} 3%, {bg} 3%)', true, ['#18181B', '#27272A', '#FFFFFF', '#E4E4E7', '#F87171', '#B91C1C'], 'Oswald', 'Inter'),
    T('sky-day', 'Sky Day', 'linear-gradient(180deg, {bg2}, {bg})', false, ['#E0F2FE', '#38BDF8', '#0C4A6E', '#075985', '#0369A1', '#0EA5E9'], 'Raleway', 'Raleway'),
    T('church-gold', 'Church Gold', BAND(90), false, ['#FFFBEB', '#FEF3C7', '#78350F', '#451A03', '#B45309', '#D97706'], 'Playfair Display', 'Lato')
  ];

  // Color schemes (like PowerPoint's "Colors" list): dark 1, light 1, dark 2, light 2, then four accents.
  // They recolor whichever design is chosen. (The names follow PowerPoint's list; the colors are our own approximations.)
  var SCHEME_DATA = [
    ['Office', '#1F2937', '#FFFFFF', '#1E3A5F', '#E7ECF3', '#4F81BD', '#C0504D', '#9BBB59', '#8064A2'],
    ['Grayscale', '#000000', '#FFFFFF', '#2B2B2B', '#EDEDED', '#808080', '#A0A0A0', '#B8B8B8', '#5C5C5C'],
    ['Adjacency', '#2F2B20', '#FFFFFF', '#4B4535', '#EFEBDD', '#A9A57C', '#9CBEBD', '#D2CB6C', '#95A39D'],
    ['Angles', '#242852', '#FFFFFF', '#26263D', '#E3E3EC', '#4F6FB5', '#E36C3A', '#D4A14B', '#ACCBF9'],
    ['Apex', '#2C2C2C', '#FFFFFF', '#3B3151', '#EDE8F2', '#69676D', '#CEB966', '#9CB084', '#6BB1C9'],
    ['Apothecary', '#3D3D2E', '#FFFFFF', '#4F4A36', '#EEEBDB', '#CF543F', '#B5AE53', '#848058', '#93A299'],
    ['Aspect', '#323232', '#FFFFFF', '#5B3A29', '#F0E8E1', '#F07F09', '#9F2936', '#1B587C', '#4E8542'],
    ['Austin', '#2E2E2E', '#FFFFFF', '#46483A', '#F0EEDB', '#94C600', '#FF6700', '#71685A', '#909465'],
    ['Black Tie', '#2A2723', '#FFFFFF', '#46464A', '#EDEBE3', '#6F6F74', '#A7B789', '#BEAE98', '#92A9B9'],
    ['Civic', '#242C3A', '#FFFFFF', '#3D4A5C', '#E8EBEF', '#D16349', '#CCB400', '#8CADAE', '#8C7B70'],
    ['Clarity', '#292934', '#FFFFFF', '#3E4256', '#EBEBF2', '#93A299', '#AD8F67', '#726056', '#4C5A6A'],
    ['Composite', '#2D2D2D', '#FFFFFF', '#4C5058', '#E9EAEC', '#98C723', '#59B0B9', '#DEAE00', '#B77BB4'],
    ['Concourse', '#242424', '#FFFFFF', '#3B3F5C', '#E6E8F0', '#2DA2BF', '#DA1F28', '#EB641B', '#39639D'],
    ['Couture', '#2B2A29', '#FFFFFF', '#4B4743', '#EEEBE6', '#9E8E5C', '#A09781', '#85776D', '#AEAFA9'],
    ['Elemental', '#212D3B', '#FFFFFF', '#3A4B5E', '#E5EAF0', '#629DD1', '#297FD5', '#7F8FA9', '#4D597F'],
    ['Equity', '#3A2E2C', '#FFFFFF', '#4E3C38', '#F0E9E7', '#D34817', '#9B2D1F', '#A28E6A', '#956251'],
    ['Essential', '#262626', '#FFFFFF', '#46433B', '#EFEEE9', '#C8161D', '#E0A528', '#6E8B3D', '#2D6E9E'],
    ['Executive', '#2A2F36', '#FFFFFF', '#3B4F63', '#E8EDF2', '#6076B4', '#9C5252', '#E68422', '#846648'],
    ['Flow', '#04617B', '#FFFFFF', '#0F6FC6', '#DBF5F9', '#0F6FC6', '#009DD9', '#0BD0D9', '#10CF9B'],
    ['Foundry', '#323A33', '#FFFFFF', '#4A5C4D', '#EAF0EB', '#72A376', '#B0CCB0', '#A8B97F', '#9AB5E4'],
    ['Grid', '#3A3A3A', '#FFFFFF', '#4A4A4A', '#EEEEEE', '#C66951', '#BF974D', '#928B70', '#87706B']
  ];
  var SCHEMES = SCHEME_DATA.map(function (r) { return { name: r[0], sw: r.slice(1) }; }); // sw = the 8 colors

  function themeById(id) { for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i]; return null; }
  function schemeByName(n) { for (var i = 0; i < SCHEMES.length; i++) if (SCHEMES[i].name === n) return SCHEMES[i]; return null; }
  function schemeColors(sc, dark) { // dark designs use the dark colors as background, light designs the light ones
    var w = sc.sw;
    return dark ? { bg: w[0], bg2: w[2], title: w[1], body: w[3], ac: w[4], ac2: w[5] }
                : { bg: w[1], bg2: w[3], title: w[0], body: w[2], ac: w[4], ac2: w[5] };
  }

  function colors(d, scheme, custom) { // scheme: '' = the design's own colors, a scheme name, or 'custom'
    if (scheme === 'custom' && custom) return Object.assign({}, d.c, custom);
    if (scheme) { var sc = schemeByName(scheme); if (sc) return schemeColors(sc, d.dark); }
    return d.c;
  }
  function resolve(d, c) {
    return { id: d.id, name: d.name, bg: c.bg, css: fill(d.shape, c), title: { color: c.title, font: d.title.font }, body: { color: c.body, font: d.body.font }, accent: c.ac, accent2: c.ac2 };
  }

  S.designs = { THEMES: THEMES, SCHEMES: SCHEMES, themeById: themeById, schemeByName: schemeByName, schemeColors: schemeColors, fill: fill, colors: colors, resolve: resolve };
})();
