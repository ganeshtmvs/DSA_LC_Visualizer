const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

// The problematic block is around line 555
// It looks like:
// .autoplay-row, .player-buttons {
//     display: none; /* fallback */
// }
//     display: flex;
//     align-items: center;
//     justify-content: center;
//     gap: 12px;
//     margin-top: 15px;
//     padding-top: 15px;
//     border-top: 1px solid rgba(255, 255, 255, 0.05);
// }

const badBlock = `}
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}`;
css = css.replace(badBlock, '}');

fs.writeFileSync('styles.css', css);
console.log("Fixed styles.css");
