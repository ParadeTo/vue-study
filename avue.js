function def(obj, key, val, enumerable) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true,
  })
}

// 数据响应式
function defineReactive(obj, key, val) {
  // 创建一个Dep实例
  const dep = new Dep()
  // 递归处理
  const childOb = observe(val)
  Object.defineProperty(obj, key, {
    get() {
      console.log('get', key)

      // 依赖收集: 把watcher和dep关联
      // 希望Watcher实例化时，访问一下对应key，同时把这个实例设置到Dep.target上面
      if (Dep.target) {
        dep.addDep(Dep.target)
        if (childOb) {
          /**
           * 例子：
           * obj: {}
           * watcher 依赖的是 obj 这个 key
           * 但是当执行 this.$set(this.obj, 'age', 18) 这个语句的时候，此时 obj 并没有发生赋值操作，watcher 不会被通知更新
           * 所以这里需要把 obj 指向的这个对象也添加到 wathcer 的依赖里面去，当调用 this.$set 的时候，手动 notify
           */
          childOb.dep.addDep(Dep.target)
        }
      }

      return val
    },
    set(newVal) {
      if (newVal !== val) {
        console.log('set', key, newVal)
        observe(newVal)
        val = newVal

        // 通知更新
        dep.notify()
      }
    },
  })
}

// 让我们使一个对象所有属性都被拦截
function observe(value) {
  if (typeof value !== 'object' || value == null) {
    return
  }

  // 创建Observer实例:以后出现一个对象，就会有一个Observer实例
  return new Observer(value)
}

// 代理data中数据
function proxy(vm) {
  Object.keys(vm.$data).forEach((key) => {
    Object.defineProperty(vm, key, {
      get() {
        return vm.$data[key]
      },
      set(v) {
        vm.$data[key] = v
      },
    })
  })

  Object.keys(vm.$methods).forEach((key) => {
    Object.defineProperty(vm, key, {
      get() {
        return vm.$methods[key]
      },
    })
  })
}

// KVue:
// 1.响应式操作
class AVue {
  constructor(options) {
    // 保存选项
    this.$options = options
    this.$data = options.data
    this.$methods = options.methods

    // 响应化处理
    observe(this.$data)

    // 代理
    proxy(this)

    // 编译器
    new Compiler('#app', this)
  }

  $set(target, propertyName, value) {
    target[propertyName] = value
    const ob = target.__ob__
    defineReactive(ob.value, propertyName, value)
    ob.dep.notify()
    return value
  }

  getVal(exp) {
    // 将匹配的值用 . 分割开，如 vm.data.a.b
    exp = exp.split('.')

    // 归并取值
    return exp.reduce((prev, next) => {
      return prev[next]
    }, this.$data)
  }

  setVal(exp, val) {
    exp.split('.').reduce((data, current, index, arr) => {
      if (index === arr.length - 1) {
        return (data[current] = val)
      }
      return data[current]
    }, vm.$data)
  }
}

// 做数据响应化
class Observer {
  constructor(value) {
    def(value, '__ob__', this)

    this.value = value
    this.walk(value)
  }

  // 遍历对象做响应式
  walk(obj) {
    Object.keys(obj).forEach((key) => {
      defineReactive(obj, key, obj[key])
    })
  }
}

// Compiler: 解析模板，找到依赖，并和前面拦截的属性关联起来
// new Compiler('#app', vm)
class Compiler {
  constructor(el, vm) {
    this.$vm = vm
    this.$el = document.querySelector(el)

    // 执行编译
    this.compile(this.$el)
  }

  compile(el) {
    // 遍历这个el
    el.childNodes.forEach((node) => {
      // 是否是元素
      if (node.nodeType === 1) {
        // console.log('编译元素', node.nodeName)
        this.compileElement(node)
      } else if (this.isInter(node)) {
        // console.log('编译文本', node.textContent);
        this.compileText(node)
      }

      // 递归
      if (node.childNodes) {
        this.compile(node)
      }
    })
  }

  // 解析绑定表达式{{}}
  compileText(node) {
    // 获取正则匹配表达式，从vm里面拿出它的值
    // node.textContent = this.$vm[RegExp.$1]
    this.update(node, RegExp.$1, 'text')
  }

  // 编译元素
  compileElement(node) {
    // 处理元素上面的属性，典型的是k-，@开头的
    const attrs = node.attributes
    Array.from(attrs).forEach((attr) => {
      // attr:   {name: 'k-text', value: 'counter'}
      const attrName = attr.name
      const exp = attr.value
      if (attrName.indexOf('k-') === 0) {
        // 截取指令名称 text
        const dir = attrName.substring(2)
        // 看看是否存在对应方法，有则执行
        this[dir] && this[dir](node, exp)
      }
      // 事件处理
      if (attrName.indexOf('@') === 0) {
        // 截取指令名称 text
        const dir = attrName.substring(1)
        // 看看是否存在对应方法，有则执行
        this[dir] && this[dir](node, exp)
      }
    })
  }

  // @click
  click(node, exp) {
    node.addEventListener('click', this.$vm[exp].bind(this.$vm))
  }

  // k-model
  model(node, exp) {
    this.update(node, exp, 'model')

    node.addEventListener('input', (e) => {
      this.$vm[exp] = e.target.value
    })
  }

  // k-text
  text(node, exp) {
    // node.textContent = this.$vm[exp]
    this.update(node, exp, 'text')
  }

  // k-html
  html(node, exp) {
    // node.innerHTML = this.$vm[exp]
    this.update(node, exp, 'html')
  }

  // dir:要做的指令名称
  // 一旦发现一个动态绑定，都要做两件事情，首先解析动态值；其次创建更新函数
  // 未来如果对应的exp它的值发生变化，执行这个watcher的更新函数
  update(node, exp, dir) {
    // 初始化
    const fn = this[dir + 'Updater']
    fn && fn(node, this.$vm.getVal(exp))

    // 更新，创建一个Watcher实例
    new Watcher(this.$vm, exp, (val) => {
      fn && fn(node, val)
    })
  }

  modelUpdater(node, val) {
    node.value = val
  }

  textUpdater(node, val) {
    node.textContent = val
  }

  htmlUpdater(node, val) {
    node.innerHTML = val
  }

  // 文本节点且形如{{xx}}
  isInter(node) {
    return node.nodeType === 3 && /\{\{(.*)\}\}/.test(node.textContent)
  }
}

// 管理一个依赖，未来执行更新
class Watcher {
  constructor(vm, key, updateFn) {
    this.vm = vm
    this.key = key
    this.updateFn = updateFn

    // 读一下当前key，触发依赖收集
    Dep.target = this
    vm.getVal(key)
    Dep.target = null
  }

  // 未来会被dep调用
  update() {
    this.updateFn.call(this.vm, this.vm.getVal(this.key))
  }
}

// Dep: 保存所有watcher实例，当某个key发生变化，通知他们执行更新
class Dep {
  constructor() {
    this.deps = []
  }

  addDep(watcher) {
    this.deps.push(watcher)
  }

  notify() {
    this.deps.forEach((dep) => dep.update())
  }
}
