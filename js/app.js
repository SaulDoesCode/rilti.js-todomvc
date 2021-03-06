// rilti.js TodoMVC
// by @SaulDoesCode
{
  'use strict'
// Getting all the functions needed
  const {dom, domfn, route, isEmpty, isStr, isBool, each, on, once, notifier, curry} = rilti
  const {query, queryAll, li, div, label, input, button} = dom // dom contains shorthand querySelector, on, once and element creation stuff
  const {Class, remove, attr} = domfn // domfn contains all the DOM manipulation functions

  const STORENAME = 'todos-rilti'
  const ENTER = 13
  const isEnter = evt => evt.which == ENTER

// NODES for interaction
  const list = query('ul.todo-list')
  const toggleAll = query('input.toggle-all')
  const footer = query('.todoapp > .footer')
  const clearCompleted = query('.clear-completed', footer)
  const counter = query('.todo-count', footer)
  const counters = counter.childNodes // no need to recreate the internal nodes each update

  const Todo = notifier({ // centralized pub/sub event emitter and storage object
    items: new Map(), // [[todoNotifier0, [message, state]], [todoNotifier1, [message, state]], ...]
    uncompleted: 0, // no get set listeners just plain mutable property in object
    get count () {
      return Todo.items.size // just easier and more semantic
    }
  })

  let visibility = '' // vue's todomvc used something like this

  // instead of functions for everything, why not events
  Todo.on.update(() => {
 // The Bridge

    const todoArr = []
    let uncompleted = 0
    each(Todo.items, item => {
      if (!item[1]) uncompleted += 1 // honest manual updating
      todoArr.push(item)
    })

    localStorage.setItem(STORENAME, JSON.stringify(todoArr)) // save the lot

    toggleAll.checked = (Todo.uncompleted = uncompleted) < (Todo.count / 2) // switches half way instead of all or nothing

  // don't want to attach methods to nodes or wrap them like Jquery
  // manual first param style is simple and does the job
  // without copying methods onto nodes or wrapper objects, or *gasp* slow proxy object handles
  // yeah proxies for dom manipulation looks fun but it's just too slow and doesn't play well with old
  // browsers
    Class(footer, 'hidden', Todo.count < 1)
    Class(clearCompleted, 'hidden', visibility === 'active' || (!(visibility === 'active') && uncompleted === Todo.count))
  // eh, fugly one liners, I adore their brevity but they have faces only a mother could love, forgive me yeah?
    counters[1].textContent = ` item${(counters[0].textContent = uncompleted) != 1 ? 's' : ''} left`
  })

  Todo.on.updateTodo(todo => { // teleporter room has new geust
    const {value, state} = todo // GUEST: I am a todo of the [value,state] planetary system
    Todo.items.set(todo, [value, state]) // recieve and log guest's arrival
    todo.emit('post-update', value, state) // send confirmation to ground crew
    Todo.emit.update() // advance to bridge
  })

  Todo.on.deleteTodo(todo => {
  // hoh!?!?! it's so simple
  // did this with arrays at first
  // but oy vey, Sets and Maps
  // with their .delete and .has
  // they drive a hard bargain
    Todo.items.delete(todo)
    Todo.emit.update()
  })

// Two todos with the same name? Not so fast.
  const canPass = (value, oldvalue) => {
    let pass = !(isEmpty(value) || value == oldvalue)
    each(Todo.items, item => {
      if (item[0] === value) pass = false
    })
    return pass
  }

  const mutProp = curry((host, prop, state) => host[prop] = state) // for the illusion of functional code

  const shouldHide = state => (!state && visibility === 'done') || (state && visibility === 'active')

  const newTodo = (value, state = false) => {
    if (!canPass(value)) return
 // internal notifier, because assigning the various
 // nodes to variables for mutation is messier in my mind
 // therefore just update using events
    const todo = notifier({
        value,
        state,
          // this method is a terrible sin, but alas, it makes the code smaller
        toggle (newstate = !state) {
          todo.emit.toggle(newstate)
          todo.emit.update(newstate)
        }
      }),
      when = todo.on, now = todo.emit // I like short everything, as you could probably tell.

    when.update(val => {
   // two separate listeners for value & state? no ways
      if (isBool(val) && val !== todo.state) todo.state = val
      if (isStr(val) && canPass(val, todo.value)) todo.value = val
      Todo.emit.updateTodo(todo) // beaming-up
    })

    when.editing((active, newval) => {
      if (!active && canPass(newval)) {
        now.update(newval)
        now.editing(todo.editing = true)
      }
    })

    li({
      render: list,
      lifecycle: {
        create (el) {
          // Ground Crew HeadQuarters
          when.hidden(() => Class(el, 'hidden', shouldHide(todo.state)))
          when.editing(active => Class(el, 'editing', active))
          when('post-update', () => Class(el, {
            hidden: shouldHide(todo.state),
            editing: !!todo.editing,
            completed: todo.state
          }))
          when.delete(() => remove(el)) // so simple, no need for complexity just inform and act

          now.update() // all set up, now beam me up to the mother-Todo-ship
        }
      }
    },

  div({class: 'view'},

   input({
     class: 'toggle',
     attr: {
       type: 'checkbox'
     },
     props: {
       checked: state
     },
     lifecycle: {
       create (el) {
         when.toggle(mutProp(el, 'checked'))
       }
     },
     on: {
       change (e, el) {
         now.update(el.checked)
       }
     }
   }),

   label({
     on: { dblclick () { now('editing', true) } },
     lifecycle: {
       create (el) { when('post-update', mutProp(el, 'textContent')) }
     }
   }, value),

   button({ // Ground Crew self destruct unit
     class: 'destroy',
     // action is a simle on click handler you can add on elements
     // its manager "{off, once, on, reseat}" is assigned to the element
     // in case you need to disable it or something
     // but hey, it's nice for buttons and stuff
     on: {
       click () {
         // ooh here's one: The bugs mostly come at night, mostleh...
         Todo.emit.deleteTodo(todo)
         now.delete()
       }
     }
   })

  ),

  input({
    class: 'edit',
    props: {value},
    lifecycle: {
      mount (el) {
        const focusChecker = on.blur(el, () => now.editing(false, el.value.trim())).off()
        // on(...) is active by default so .off just stops it
        // rilti event listeners always return a manager object, rilti.dom.on(...) -> {off,on,once,reseat}
        // they even have reseat methods which allows you to transfer or copy the listener to another target

        when('editing', active => { // I like the idea of meaningful/recursive/polymorphic event handles
          el[active ? 'focus' : 'blur']()
          focusChecker[active ? 'on' : 'off']()
        })
      }
    },
    on: {
      keyup (e, el) {
        if (isEnter(e)) now.editing(false, el.value.trim())
      }
    }
  })

 )
}

// shrt evrythng
  each(JSON.parse(localStorage.getItem(STORENAME) || '[]'), item => newTodo(item[0], item[1]))

// prolly too short in places though, this is just madness right?, 2 lines of brackets that bad?
// shrt evrythng man, write that stuff pre-minified!!! ;D
  on.change(toggleAll, (e, el, state = el.checked) => each(Todo.items, (_, todo) => todo.toggle(state)))
  on.click(clearCompleted, () => each(Todo.items, (item, todo) => todo.state && todo.emit.delete()))

// this one was way too ugly as a one liner sad, but oh well
// on('input.new-todo', 'keydown', (e, el) => isEnter(e) && (!newTodo(el.value.trim()) && (el.value = '')));
  on('input.new-todo', 'keydown', (e, el) => {
    if (isEnter(e)) {
      newTodo(el.value.trim())
      el.value = ''
    }
  })

  const filters = queryAll('ul.filters > li > a') // returns a lovely array of nodes instead of the dreaded NodeList
// eh NodeList is getting better, heard they were adding forEach on NodeList and other arraylikes
// so we've got that going

// usually route has 2 arguments, but, with only a func it's basically just an onhashchange listener
// which is fine because I'm going for brevity here, so tired of endless module imports and stuff
// give me teh monolithic give me teh 4000 lines, cause my screen ain't got space foh all dem tabs
// of terrible module files whoose exports could have been written in 3 lines or less
  route(() => {
    visibility = location.hash === '#/active' ? 'active' : location.hash === '#/completed' ? 'done' : '' // ternary is my jam
    Class(clearCompleted, 'hidden', visibility === 'active')
    Class(counter, 'hidden', visibility === 'done')
    each(Todo.items, (_, todo) => todo.emit.hidden())
    each(filters, filter => Class(filter, 'selected', attr(filter, 'href') === location.hash))
  })
  if (!location.hash) location.hash = '#/'

  Class(footer, 'hidden', Todo.count < 1)

// yep, that's it thanks for reading, and please tell people about rilti.js
// spare a star for a poor south african developer? I beg of you kind sir/ma'am
}
