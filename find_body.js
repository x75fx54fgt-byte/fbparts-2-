const fs = require('fs');
const html = fs.readFileSync('admin.html', 'utf8');
if (html.includes('bo" + "dy')) {
    console.log("FOUND bo + dy");
} else {
    console.log("NOT FOUND");
}
