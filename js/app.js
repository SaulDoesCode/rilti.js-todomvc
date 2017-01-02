(root => {
	'use strict';

	const ENTER_KEY = 13;

	// Your starting point. Enjoy the ride!
	const {dom, informer, isBool} = rot;
	const {query, queryAll, queryEach, li, div, input, label, button} = dom;

	const RouteHandles = new Map();
	informer.fromEvent(root, 'hashchange').on(() => RouteHandles.forEach((route_informer, hash) => location.hash === hash && route_informer.inform()));
	const route = (hash,fn) => {
		const ri = (RouteHandles.has(hash) ? RouteHandles : RouteHandles.set(hash, informer())).get(hash);
		if(location.hash === hash) fn();
		return ri.on(fn);
	}

	const Store = name => {
			let val = localStorage.getItem(name);
			const store = rot.isStr(val) ? JSON.parse(val) : {}, inf = informer();
			return new Proxy(store, {
						get(obj, key) {
								if (key in inf) return inf[key];
								inf.inform('get', key);
								return obj[key];
						},
						set(obj, key, val) {
								if (val != obj[key]) {
									obj[key] = val;
									inf.inform('set', key, val);
									localStorage.setItem(name, JSON.stringify(obj));
									return val;
								}
						},
						deleteProperty(obj, key) {
								delete obj[key];
								inf.inform('delete', key);
								localStorage.setItem(name, JSON.stringify(obj));
						}
		});
	}

	const State = root.State = Store('todo-list');

	if(!rot.isArr(State.todoItems)) State.todoItems = [];
	console.log(...State.todoItems);

	const toggleAll = query('input.toggle-all');
	const todoCount = query('span.todo-count');
	const todolist = query('ul.todo-list');
	const footer = dom(query('.todoapp > .footer'));
	const UpdateCounter = () => {
		const num = todo.uncompleted;
		footer.toggleClass('hidden', todo.count == 0);
		todoCount.innerHTML = `<strong>${num}</strong> item${num != 1 ? 's' : ''} left`;
	}

	const todo = {
		items : new Set(),
		get count() {
			return this.items.size;
		},
		completed: 0,
		get uncompleted() {
			return this.count - this.completed;
		},
		save(state, msg, value) {
			if(State.todoItems.every(item => item.msg != msg)) {
				const representation = {state, msg};
				if(msg != value) representation.value = value;
				State.todoItems = State.todoItems.filter(item => !!item).concat([representation]);
			}
			UpdateCounter();
		},
		saveState(msg, state) {
			UpdateCounter();
			State.todoItems = State.todoItems.map(item => {
					if(item.msg === msg) item.state = state;
					return item;
			});
		},
		delete(msg) {
			State.todoItems = State.todoItems.filter(item => !!item && item.msg !== msg);
			UpdateCounter();
		}
	}

function make_todo_item(state, msg, value) {
	msg = msg.trim();
	if(!value) value = msg;

		const base = li({
			props : {
				set state(newState) {
					this.toggleClass('completed', newState);
					if(newState) todo.completed += 1;
					else if(todo.completed > 0) todo.completed -= 1;
					todo.saveState(msg, (state = newState));
				},
				get state() {
					return state;
				}
			},
			lifecycle: {
				destroy(m) {
					if(m.state) todo.completed -= 1;
					todo.items.delete(m);
					todo.delete(msg);
				}
			}
		});

		todo.items.add(base);

		const itemmsg = label({
			on: {
				dblclick() {
					dom.once(root, 'click', e => {
						if(e.target != editor) base.removeClass('editing');
					});
					base.addClass('editing');
					editor.node.focus();
				}
			}
		}, msg);

		const editor = input({
			props : {
				save() {
					let val = this.node.value.trim();
					if(val != '' && val != msg) {
						itemmsg.inner(msg = val);
						base.removeClass('editing');
						todo.save(state, msg);
					}
					return this;
				}
			},
			class:'edit',
			value,
			on: {
				keydown(e, m) {
					if(e.keyCode === ENTER_KEY) m.save();
				}
			}
		});

		const toggle = input({
			class:'toggle',
			type:'checkbox',
			lifecycle : {
				mount(m, el) {
					if(state) base.state = el.checked = state;
					base.toggle = (newState = !el.checked) => {
						if(newState != base.state) base.state = el.checked = newState;
					}
				}
			},
			on : {
				change() {
					base.state = this.checked;
				}
			}
		});

		const view = div({
			class: 'view'
		},
			toggle,
			itemmsg,
			button({
				class:'destroy',
				on: {
					click() {
						base.remove();
					}
				}
			})
		);


		todo.save(state, msg, value);
		return base.append(view, editor).appendTo(todolist);
}


	dom(query('input.new-todo'), {
		on : {
			keydown(e) {
				if(e.keyCode === ENTER_KEY) {
					make_todo_item(false, this.value);
					this.value = '';
				}
			}
		}
	});

	dom(toggleAll, {
		on : {
			change() {
				queryEach('.todo-list > li', item => item.dm.toggle(this.checked));
			}
		}
	});

	todo.save(true, 'Taste JavaScript', 'Create a TodoMVC template');
	todo.save(false, 'Buy a Unicorn', 'Rule The Web');
	State.todoItems.forEach(item => {
		const {state, msg, value} = item;
		make_todo_item(state, msg, value);
	});

	dom.on('.clear-completed', 'click', () => queryEach('li.completed', el => el.remove()));

	const modifyItems = fn => () => queryEach('.todo-list > li', item => fn(item.dm, item));

	const showCompleted = modifyItems(item => item.toggleClass('hidden', !item.state));
	const showUncompleted = modifyItems(item => item.toggleClass('hidden', item.state));
	const showAll = modifyItems(item => item.removeClass('hidden'));

	route('#/completed', showCompleted);
	route('#/active', showUncompleted);
	route('#/', showAll);

	root.todo = todo;
})(window);
