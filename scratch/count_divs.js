const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app.html');
const html = fs.readFileSync(filePath, 'utf8');

const regex = /<\/?([a-zA-Z0-9\-]+)([^>]*?)>/g;
let match;
let stack = [];
let lineNum = 1;
let lastIndex = 0;

function getLineNumber(index) {
  const textBefore = html.slice(0, index);
  return textBefore.split('\n').length;
}

while ((match = regex.exec(html)) !== null) {
  const tag = match[1].toLowerCase();
  const isClosing = match[0].startsWith('</');
  const isSelfClosing = match[0].endsWith('/>') || ['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tag);
  const startIdx = match.index;
  const currentLine = getLineNumber(startIdx);
  
  if (isSelfClosing) {
    continue;
  }
  
  if (isClosing) {
    if (stack.length === 0) {
      console.log(`Error: Extra closing tag </${tag}> on line ${currentLine}`);
    } else {
      const last = stack.pop();
      if (last.tag !== tag) {
        console.log(`Warning: Mismatched closing tag </${tag}> on line ${currentLine} (expected </${last.tag}> opened on line ${last.line})`);
      }
    }
  } else {
    // Opening tag
    const attrs = match[2];
    let id = '';
    const idMatch = attrs.match(/id=["'](.*?)["']/);
    if (idMatch) id = idMatch[1];
    
    let cls = '';
    const clsMatch = attrs.match(/class=["'](.*?)["']/);
    if (clsMatch) cls = clsMatch[1];
    
    stack.push({ tag, line: currentLine, id, cls });
  }
}

console.log("\nRemaining open tags in stack at end of file:");
while (stack.length > 0) {
  const open = stack.pop();
  console.log(`- <${open.tag}> opened on line ${open.line} (id: "${open.id}", class: "${open.cls}")`);
}
