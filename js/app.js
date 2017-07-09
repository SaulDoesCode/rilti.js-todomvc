{
	'use strict';
	 const {dom,notifier,route,isEmpty, each} = rot, {queryEach,html,li,div,label,input,button,on,once} = dom,
	 ENTER = 13, isEnter = evt => evt.which == ENTER,
	 json2map = str => new Map(JSON.parse(str)),
	 map2json = map => JSON.stringify([...map].map(i => (i[1] = i[1].state,i))),

	 list = dom('ul.todo-list'), // for rendering
	 toggleAll = dom('input.toggle-all'),
	 footer = dom('.todoapp > .footer'),
	 clearCompleted = footer.find('.clear-completed'),
	 counterNodes = footer.find('.todo-count').childNodes, // no need to recreate the internal nodes each update
	 todoItems = new Map;
	 var App = notifier({
		 get count() {
			 return todoItems.size;
		 },
		 get uncompleted() {
			 let count = 0;
			 each(todoItems, item => !item.state && count++);
			 return count;
		 },
		 counterUpdate() {
			 footer.class('hidden', this.count < 1);
			 clearCompleted.class('hidden', this.uncompleted == this.count);
			 if(this.uncompleted == this.count) toggleAll.checked = false;
			 else if(App.uncompleted < 1) toggleAll.checked = true;
 			 counterNodes[1].txt = ` item${(counterNodes[0].txt = this.uncompleted) != 1 ? 's' : ''} left`;
		 },
		 save() {
			 localStorage.setItem('todos', map2json(todoItems));
			 this.counterUpdate();
		 },
		 add(txt, state, todo) {
			 todoItems.set(txt, {state, todo});
			 this.save();
		 },
		 remove(txt) {
			 todoItems.delete(txt);
			 this.save();
		 },
		 update(oldTxt, txt, state, todo) {
			 if(oldTxt && oldTxt != txt) todoItems.delete(oldTxt);
			 todoItems.set(txt, {state, todo});
			 todo.update();
			 this.save();
		 }
	 });

	 var Archetype = li(
		 div({class:"view"},
			 input({class: "toggle", type:"checkbox"}),
			 label(), button({class: "destroy"})
		 ),
		 input({class: "edit"})
	 );

	 let activeEditor;
	 const editDisruptListener = once(window, 'click', e => {
		 if(!e.target.className.includes('edit') && activeEditor) activeEditor.editing(false);
	 }).off();

	 const newTodo = (state, txt) => {
		 txt = txt.trim();
		 if(isEmpty(txt)) return;
		 const todo = Archetype.clone(),
		 label = todo.find('label'),
		 editor = todo.find('input.edit'),
		 toggler = todo.find('input.toggle');

		 label.txt = editor.txt = txt;
		 todo.update = () => {
			 label.txt = txt;
			 todo.class('completed', state);
		 };
		 todo.toggle = (newState = !toggler.checked) => App.update(null, txt, state = toggler.checked = newState, todo);
		 editor.editing = isEditing => {
			 todo.class('editing', isEditing);
			 (activeEditor = editor)[isEditing ? 'focus' : 'blur']();
			 editDisruptListener[isEditing ? 'once' : 'off']();
			 if(!isEditing) {
				 const newTxt = editor.txt.trim();
				 if(!isEmpty(newTxt)) App.update(txt, txt = newTxt, state, todo);
			 }
		 }
		 label.ondblclick = () => editor.editing(true);
		 editor.onkeyup = e => isEnter(e) && editor.editing(false);

		 if(state) {
			 todo.class.completed = state;
			 toggler.checked = state;
		 }

		 toggler.onchange = () => App.update(null, txt, state = toggler.checked, todo)

		 todo.data.on('destroy', () => App.remove(txt));
		 todo.find('button.destroy').onclick = () => todo.remove();

		 todo.appendTo(list);
		 App.add(txt, state, todo);
	 };

	 const todoItemsJSON = localStorage.getItem('todos');
	 if(todoItemsJSON) for (let [msg, state] of json2map(todoItemsJSON)) newTodo(state, msg);
	 toggleAll.checked = App.uncompleted < 1;

	dom('input.new-todo').on.keydown((e, el) => {
		if (isEnter(e)) {
			newTodo(false, el.txt.trim());
			el.txt = '';
		}
	});

 	toggleAll.on.change((e, el) => each(todoItems, item => item.todo.toggle(el.checked)));
 	clearCompleted.on.click(() => each(todoItems, item => item.state && item.todo.remove()));


 	const filters = new Set,
 	filterer = newState => () => {
		each(todoItems, item => item.todo.class('hidden', item.state == newState));
 		filters.forEach(filter => filter.class('selected', filter.attr.href == location.hash));
 	}
	queryEach('ul.filters > li > a', filter => filters.add(dom(filter)));

 	route('#/completed', filterer(false));
 	route('#/active', filterer(true));
 	route(filterer(null));
}
