function toArray(list: any, start?: number): Array<any> {
  start = start || 0
  let i = list.length - start
  const ret: Array<any> = new Array(i)
  while (i--) {
    ret[i] = list[i + start]
  }
  return ret
}

class Vue {
  _events: {
    [key: string]: Function[]
  } = {}

  $on(event: string | Array<string>, fn: Function): Vue {
    const vm = this
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$on(event[i], fn)
      }
    } else {
      ;(vm._events[event] || (vm._events[event] = [])).push(fn)
    }
    return vm
  }

  $emit(event: string, ...args: any): Vue {
    const vm = this
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      for (let i = 0, l = cbs.length; i < l; i++) {
        try {
          cbs[i].apply(vm, args)
        } catch (e) {
          console.error(e, vm, `event handler for "${event}"`)
        }
      }
    }
    return vm
  }
}

function Emit() {
  return function(target: any, key: string, descriptor: PropertyDescriptor) {
    const originValue = descriptor.value
    descriptor.value = function(...args: any[]) {
      const returnValue = originValue.apply(this, args)
      //@ts-ignore
      this.$emit(key, returnValue)
    }
  }
}

class Comp extends Vue {
  //@ts-ignore
  @Emit()
  testFn() {
    console.log('execute testFn')
    return 'result'
  }
}

const comp = new Comp()
comp.$on('testFn', (...args: any[]) => {
  console.log('emit', args)
})

comp.testFn()

// 暗号：you can you up
