(root => {
	'use strict';

	const ENTER_KEY = 13;
	const {dom, informer, isBool} = rot, {query, queryAll, queryEach, li, div, input, label, button} = dom;

	const RouteHandles = new Map();
	informer.fromEvent(root, 'hashchange').on(() => RouteHandles.forEach((route_informer, hash) => location.hash === hash && route_informer.inform()));
	const route = (hash, fn) => {
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

	const State = Store('todo-list');
	if(!rot.isArr(State.todoItems)) State.todoItems = [];

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
		each(fn) {
			this.items.forEach(fn);
		},
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

const create_todo = (state, msg, value) => {
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

		const tlabel = label({
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
						tlabel.inner(msg = val);
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

		todo.save(state, msg, value);
		return base.append(div({class: 'view'},
			toggle,
			tlabel,
			button({
				class:'destroy',
				on: {
					click: base.remove
				}
			})
		), editor).appendTo(todolist);
}

	dom(query('input.new-todo'), {
		on : {
			keydown(e) {
				if(e.keyCode === ENTER_KEY) {
					create_todo(false, this.value);
					this.value = '';
				}
			}
		}
	});

	dom(toggleAll, {
		on : {
			change() {
				todo.each(item => item.toggle(this.checked));
			}
		}
	});

	State.todoItems.forEach(item => create_todo(item.state, item.msg, item.value));

	dom.on('.clear-completed', 'click', () => todo.each(item => {
		if(item.state) item.remove();
	}));

	const eachItem = fn => () => todo.items.forEach(fn);
	const showCompleted = eachItem(item => item.toggleClass('hidden', !item.state));
	const showUncompleted = eachItem(item => item.toggleClass('hidden', item.state));
	const showAll = eachItem(item => item.removeClass('hidden'));

	route('#/completed', showCompleted);
	route('#/active', showUncompleted);
	route('#/', showAll);

})(window);
