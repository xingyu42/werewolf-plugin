export function createDeferred () {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

export function flushPromises () {
  return new Promise(resolve => setTimeout(resolve, 0))
}
