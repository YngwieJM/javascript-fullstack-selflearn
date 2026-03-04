// function waitFiveSeconds(){
//     const start = Date.now();
//     while(Date.now() - start < 5000){}    
// }

// console.log('Start');
// waitFiveSeconds();
// console.log('End');

// console.log('Start');

// setTimeout(() => {
//     console.log("Inside timeout");
// }, 2000);

// console.log('End'); 

// function greet(name, callback, anotherCallback){
//     console.log("Hi" + name);
//     callback();
//     anotherCallback();
// }

// function newcallbackdoanotherthing(){
//     console.log("Doing another thing"); 
// }

// function sayBye(){
//     console.log("Bye");
// }

// greet("Alice", sayBye, newcallbackdoanotherthing);

//Timeout

// console.log("1");

// setTimeout(() => {
//     console.log("2");
// }, 0);

// console.log("3");

//Promise

//----------------------------//
// function delay(ms) {
//   return new Promise((resolve) => {
//     setTimeout(() => {
//       resolve();
//     }, ms);
//   });
// }

// delay(1000).then(() => {
//     console.log("A");
//     return delay(1000);
// }).then(() => {
//     console.log("B");
//     return delay(1000);
// }).then(() => {
//     console.log("C");
// });


// async function run(){
//     await delay(1000);
//     console.log("A");
//     await delay(1000);
//     console.log("B");
//     await delay(1000);
//     console.log("C");
// }
// run();

// function delay(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }
//----------------------------//

//----------------------------//
// async function run() {
//     console.log("Start");
//     await delay(1000);
//     console.log("Middle");
//     await delay(1000);
//     console.log("End");
// }

// run();
//----------------------------//

// async function test() {
//   throw new Error("Boom");
// }

// test();
// console.log("After");

// test().catch(err => {
//     console.error("Caught error:", err);
// });

// async function run(){
//     try {
//         await test();
//     } catch (err) {
//         console.error("Caught:", err.message);
//     }
// }

// run();

async function example(){
    console.log("1");
    await Promise.resolve();
    console.log("2");
}

console.log("3");
example();
console.log("4");