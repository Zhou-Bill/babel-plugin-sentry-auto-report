import * as sentry from 'sentry'
function sleep() {
  return new Promise(resolve => setTimeout(resolve, 1000));
}

async function test() {
  const data = await sleep().catch(function(){
  	console.log("hahhah")
  });
  const data2 = await sleep().catch((e) => {
    sentry.captureException(e)
  	console.log(e)
  });
  console.log(123)
}


async function test1() {
  let isTrue = false
    
  try {
    const data = await sleep()
  } catch(e) {
    console.log(123)
  }
}

async function test2() {
  let isTrue = false
    
  try {
    const data = await sleep()
  } catch(e) {
    sentry.captureException(e)
    console.log(123)
  }
}


class Store {
  name = ''
  constructor(name) {
    this.name = name
  }

  async getData() {
    let isTrue = false
    
    try {
      const data = await sleep()
    } catch(e) {
      const data = await sleep();
      
    }
    
    console.log(123)
  }

  getData2() {
  	sleep().then(() => {
    	console.log("getData")
    })
  }
}