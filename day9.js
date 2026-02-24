function createBankAccount(owner) {
    let balance = 0;
    function deposit(amount) {
        balance += amount;
    }
    function withdraw(amount) {
        if (amount > balance) {
            throw new Error("Insufficient funds");
        }
        balance -= amount;
    }
    function getBalance() {
        return balance
    }

    return {
        deposit,
        withdraw,
        getBalance
    };
}

const account = createBankAccount("Yngwie");

account.deposit(100);
account.withdraw(30);
console.log(account.getBalance());
account.balance;


function createCounter() {
    let count = 0;
    return function() {
        count++;
        return count;
    }
}

const counter = createCounter();    

counter();
counter();
counter();

function processOrder(){
    if(true){
        let OrderId = Math.random();
        console.log("Processing order " + OrderId);
    }

    // console.log(OrderID); error: OrderID is not defined
}
processOrder();
// console.log(OrderID); error: OrderID is not defined

let value = 2;

if (value > 3 && value < 10 || value === 100) {
  console.log("YES");
} else {
  console.log("NO");
}