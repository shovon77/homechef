const fs = require('fs');
const p = 'app/chef/[id].tsx';
let s = fs.readFileSync(p, 'utf8');

// Replace backslash-escaped template literals with plain concatenation
s = s.split("\\`Dish #\\${d.id}\\`").join("('Dish #' + d.id)");
s = s.split("`Dish #${d.id}`").join("('Dish #' + d.id)");

s = s.split("\\`Chef #\\${resolvedId}\\`").join("('Chef #' + resolvedId)");
s = s.split("`Chef #${resolvedId}`").join("('Chef #' + resolvedId)");

// (Optional) similar fallback if any other spots slipped through
s = s.split("\\`Dish #\\${dishId}\\`").join("('Dish #' + dishId)");
s = s.split("`Dish #${dishId}`").join("('Dish #' + dishId)");

fs.writeFileSync(p, s);
console.log('✅ Replaced problematic template literals with concatenation in', p);
