const fs = require('fs');
const notes = fs.readFileSync('MamiRocksPeakD&DNotSitesi.html', 'utf8');
const style = notes.match(/<style[^>]*>([\s\S]*?)<\/style>/i)[1];

console.log('Total characters in notes style:', style.length);
// Let's test a simple selector scoping or CSS nesting:
// Does all modern browsers (Chrome, Edge, Firefox, Safari) support native CSS nesting?
// Yes! CSS nesting has been standard in all major browsers since 2023!
// E.g.:
// #notes-view-container {
//   --bg: #1a1714;
//   ...
//   .titlebar { ... }
//   .layout { ... }
// }
