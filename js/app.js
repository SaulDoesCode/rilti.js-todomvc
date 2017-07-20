// rilti.js TodoMVC
// by @SaulDoesCode
{
'use strict';
// Getting all the functions needed
const {dom,domfn,route,isEmpty,isStr,isBool,each,notifier,pipe,curry} = rilti,
{queryAll,li,div,label,input,button,on,once} = dom, // dom contains shorthand querySelector, on, once and element creation stuff
{Class, remove, attr} = domfn, // domfn contains all the DOM manipulation functions

STORENAME = 'todos-rilti', ENTER = 13,
isEnter = evt => evt.which == ENTER,

// NODES for interaction
list = dom('ul.todo-list'), // for faster rendering
toggleAll = dom('input.toggle-all'),
footer = dom('.todoapp > .footer'),
clearCompleted = dom('.clear-completed', footer),
counter = dom('.todo-count', footer),
counters = counter.childNodes, // no need to recreate the internal nodes each update

Todo = notifier({ // centralized pub/sub event emitter and storage object
  items: new Map, // [[todoNotifier0, [message, state]], [todoNotifier1, [message, state]], ...]
  uncompleted:0, // no get set listeners just plain mutable property in object
  get count() { return Todo.items.size } // just easier
});

let visibility = ''; // vue's todomvc used something like this

// instead of functions for everything, why not events
Todo.on('update', () => { // The Bridge

  const todoArr = [];
  let uncompleted = 0;
  each(Todo.items, item => {
    if(!item[1]) uncompleted++; // honest manual updating
    todoArr.push(item);
  });

  localStorage.setItem(STORENAME, JSON.stringify(todoArr)); // save the lot

  toggleAll.checked = (Todo.uncompleted = uncompleted) < (Todo.count / 2); // switches half way instead of all or nothing

  // don't want to attach methods and things to nodes or wrap them like Jquery
  // manual first param style is simply and does the job
  // without copying methods onto nodes or wrapper objects, or *gasp* slow proxy object handles
  // yeah proxies for dom manipulation looks fun but it's just too slow and doesn't play well with old
  // browsers
  Class(footer, 'hidden', Todo.count < 1);
  Class(clearCompleted, 'hidden', visibility === 'active' || (!(visibility === 'active') && uncompleted === Todo.count));
  // eh, fugly one liners, I adore their brevity but they have faces only a mother could love, forgive me yeah?
  counters[1].textContent = ` item${(counters[0].textContent = uncompleted) != 1 ? 's' : ''} left`;
});

Todo.on('updateTodo', todo => { // teleporter room has new geust
  const {value, state} = todo; // GUEST: I am a todo of the [value,state] planetary system
  Todo.items.set(todo, [value, state]); // recieve and log geust arrival
  todo.emit('post-update', value, state); // send confirmation to ground crew
  Todo.emit('update'); // advance to bridge
});

Todo.on('deleteTodo', todo => {
  // hoh!?!?! it's so simple
  // tried this with arrays
  // but oy vey, Sets and Maps
  // with their .delete
  // they drive a hard bargain
  Todo.items.delete(todo);
  Todo.emit('update');
});

// Two todos with the same name? Not so fast.
const canPass = (value, oldvalue) => {
  let pass = !(isEmpty(value) || value == oldvalue);
  each(Todo.items, item => {
    if(item[0] === value) pass = false;
  });
  return pass;
},

mutProp = curry((host, prop, state) => host[prop] = state), // for the illusion of functional code

shouldHide = state => (!state && visibility === 'done') || (state && visibility === 'active'),

newTodo = (value, state = false) => {
 if(!canPass(value)) return;
 // internal notifier, because assigning the various
 // nodes to variables for mutation is messier in my mind
 // therefore just update using events
 const todo = notifier({
   value, state,
   // this method is a terrible sin
   // but alas, it makes the code smaller
   toggle(newstate = !state) {
     todo.emit('toggle', newstate).emit('update', newstate);
   }
 }),
 when = todo.on, now = todo.emit; // I like short everything, as you could probably tell.

 when('update', val => {
   // two separate listeners for value & state? no ways
   if(isBool(val) && val !== todo.state) todo.state = val;
   if(isStr(val) && canPass(val, todo.value)) todo.value = val;
   Todo.emit('updateTodo', todo); // beaming-up
 });

 when('editing', (active, newval) => {
   if(!active && canPass(newval)) {
     now('update', newval);
     now('editing', todo.editing = true);
   }
 });

 li({
     render:list,
     lifecycle: {
       create(el) {
          // Ground Crew HeadQuarters
          when('hidden', () => Class(el, 'hidden', shouldHide(todo.state)));
          when('editing', active => Class(el, 'editing', active));
          when('post-update', () => pipe(el) // these pipe thingys are fun :P
            (Class, 'editing', !!todo.editing) // usually Class(el, 'class-name', {=state})
            (Class, 'hidden', shouldHide(todo.state)) // but the pipe adds the node with more args and returns
            (Class, 'completed', todo.state) // the return value of the function as a new pipe(val) => (fn, ...args) => pipe(newval = fn(val, ...args))
            // pipe will only release it's value when it's called with no func, pipe(5)((a,b) => a+b, 5)() -> 10
          );
          when('delete', () => remove(el)); // so simple, no need for complexity just inform and act

          now('update'); // all set up, now beam me up to the mother-Todo-ship
       }
     }
  },

  div({class:"view"},

   input({
     class: "toggle",
     type: "checkbox",
     checked:state,
     lifecycle:{
       create(el) { when('toggle', mutProp(el, 'checked')) }
     },
     on: {
       change(e, el) { now('update', el.checked) }
     }
   }),

   label({
     on:{ dblclick() { now('editing', true) } },
     lifecycle:{
       create(el) { when('post-update', mutProp(el, 'textContent')) }
     }
   }, value),

   button({ // Ground Crew self destruct unit
     class: "destroy",
     // action is a simle on click handler you can add on elements
     // its manager "{off, once, on, reseat}" is assigned to the element
     // in case you need to disable it or something
     // but hey, it's nice for buttons and stuff
     action() {
       // ooh here's one: The bugs mostly come at night, mostleh...
       Todo.emit('deleteTodo', todo);
       now('delete');
     }
   })

  ),

  input({
    class: "edit",
    value,
    lifecycle:{
      mount(el) {
        // not sure if mess or good idea
        const focusChecker = on(window, 'click', e => {
          if(!e.target.isSameNode(el)) {
            now('editing', false, el.value.trim());
            focusChecker.off();
          }
        }, { canCapture:false }).off(); // on(...) is active by default so this just stops it
        // rilti event listeners always return a manager rilti.dom.on(...) -> {off,on,once,reseat}
        // it even has a reseat method that allows you to transfer or copy the listener to another target

        when('editing', active => { // I like the idea of meaningful/recursive/polymorphic event handles
          el[active ? 'focus' : 'blur']()
          if(active) focusChecker.on();
        });
      }
    },
    on: {
      keyup(e, el) {
        if(isEnter(e)) now('editing', false, el.value.trim());
      }
    }
  })

 );
};

// shrt evrythng
each(JSON.parse(localStorage.getItem(STORENAME) || '[]'), item => newTodo(item[0], item[1]));

// prolly too short in places though, this is just madness right?, 2 lines of brackets that bad?
// shrt evrythng man, write that stuff pre-minified!!! ;D
on(toggleAll, 'change', (e, el, state = el.checked) => each(Todo.items, (_, todo) => todo.toggle(state)));
on(clearCompleted, 'click', () => each(Todo.items, (item, todo) => todo.state && todo.emit('delete')));

// this one was way too ugly as a one liner sad, but oh well
// on('input.new-todo', 'keydown', (e, el) => isEnter(e) && (!newTodo(el.value.trim()) && (el.value = '')));
on('input.new-todo', 'keydown', (e, el) => {
	if (isEnter(e)) {
		newTodo(el.value.trim());
		el.value = '';
	}
});

const filters = queryAll('ul.filters > li > a'); // returns a lovely array of nodes instead of the dreaded NodeList
// eh NodeList is getting better, heard they were adding forEach on NodeList and other arraylikes
// so we've got that going

// usually route has 2 arguments, but, with only a func it's basically just an onhashchange listener
// which is fine because I'm going for brevity here, so tired of endless module imports and stuff
// give me teh monolithic give me teh 4000 lines, cause my screen ain't got space foh all dem tabs
// of terrible module files whoose exports could have been written in 3 lines or less
route(() => {
  visibility = location.hash === '#/active' ? 'active' : location.hash === '#/completed' ? 'done' : ''; // ternary is my jam
  Class(clearCompleted, 'hidden', visibility === 'active');
  Class(counter, 'hidden', visibility === 'done');
  each(Todo.items, (_, todo) => todo.emit('hidden'));
  each(filters, filter => Class(filter, 'selected', attr(filter, 'href') === location.hash));
});

if(!location.hash) location.hash = '#/';
// yep, it is what it is.
// spare a star for a poor south african developer? I beg of you kind sir/ma'am
}
