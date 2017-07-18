{
'use strict';
// Getting all the functions needed
const {dom,domfn,route,isEmpty,isStr,isBool,each,notifier,pipe,curry} = rilti,
{queryAll,li,div,label,input,button,on,once} = dom, // dom contains shorthand querySelector, on, once and element creation stuff
{Class, remove} = domfn, // domfn contains all the DOM manipulation functions

STORENAME = 'todos-rilti', ENTER = 13,
isEnter = evt => evt.which == ENTER,

// NODES for interaction
list = dom('ul.todo-list'), // for faster rendering
toggleAll = dom('input.toggle-all'),
footer = dom('.todoapp > .footer'),
clearCompleted = dom('.clear-completed', footer),
counter = dom('.todo-count', footer),
counters = counter.childNodes, // no need to recreate the internal nodes each update

  items: new Map,
  uncompleted:0,
  get count() { return Todo.items.size }
});

let visibility = '';

Todo.on('update', () => {
  const todoArr = [];
  let uncompleted = 0;
  each(Todo.items, item => {
    if(!item[1]) uncompleted++;
    todoArr.push(item);
  });
  localStorage.setItem(STORENAME, JSON.stringify(todoArr));
  toggleAll.checked = (Todo.uncompleted = uncompleted) < (Todo.count / 2);
  Class(footer, 'hidden', Todo.count < 1);
  Class(clearCompleted, 'hidden', visibility === 'active' || (!(visibility === 'active') && uncompleted === Todo.count));
  counters[1].textContent = ` item${(counters[0].textContent = uncompleted) != 1 ? 's' : ''} left`;
});

Todo.on('updateTodo', todo => {
  Todo.items.set(todo, [todo.value, todo.state]);
  todo.emit('post-update', todo.value, todo.state);
  Todo.emit('update');
});

Todo.on('deleteTodo', (todo, value, state) => {
  Todo.items.delete(todo);
  Todo.emit('update');
});

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
 const todo = notifier({
   value, state,
   toggle(newstate = !state) {
     todo.emit('toggle', newstate).emit('update', newstate);
   }
 }),
 when = todo.on, now = todo.emit; // I like shorthand everything, as you could probably tell.

 when('update', val => {
   if(isBool(val) && val !== todo.state) todo.state = val;
   if(isStr(val) && canPass(val, todo.value)) todo.value = val;
   Todo.emit('updateTodo', todo);
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
          const mutPipe = pipe(el);
          when('hidden', () => mutPipe(Class, 'hidden', shouldHide(todo.state)));
          when('editing', active => mutPipe(Class, 'editing', active));
          when('post-update', () => mutPipe
            (Class, 'editing', !!todo.editing)
            (Class, 'hidden', shouldHide(todo.state))
            (Class, 'completed', todo.state)
          );
          when('delete', () => mutPipe(remove));
          now('update');
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

   button({
     class: "destroy",
     action() {
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
        when('editing', active => {
          el[active ? 'focus' : 'blur']()
          if(active) {
            const focusLossListener = on(window, 'click', e => {
              if(!e.target.isSameNode(el)) {
                now('editing', false, el.value.trim());
                focusLossListener.off();
              }
            }, { canCapture:false });
          }
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

each(JSON.parse(localStorage.getItem(STORENAME) || '[]'), item => newTodo(item[0], item[1]));

on(toggleAll, 'change', () => {
  const state = toggleAll.checked;
  each(Todo.items, (_, todo) => todo.toggle(state));
});

on(clearCompleted, 'click', () => each(Todo.items, (item, todo) => todo.state && todo.emit('delete')));

on('input.new-todo', 'keydown', (e, el) => {
	if (isEnter(e)) {
		newTodo(el.value.trim());
		el.value = '';
	}
});

const filters = queryAll('ul.filters > li > a');
route(() => {
  visibility = location.hash === '#/active' ? 'active' : location.hash === '#/completed' ? 'done' : '';
  Class(clearCompleted, 'hidden', visibility === 'active');
  Class(counter, 'hidden', visibility === 'done');
  each(Todo.items, (item, todo) => todo.emit('hidden'));
	each(filters, filter => Class(filter, 'selected', filter.href === location.hash));
});
}
