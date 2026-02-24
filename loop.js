let x = 0;

while (x < 3) {
  console.log(x);
  x++;
}

let y = 0;

while (y < 3) {
  console.log(y);
  y++;
}

for (let i = 0; i < 5; i++) {
  if (i === 2) {
    continue;
  }
  console.log(i);
}

while (true) {
  console.log("Hello");
}