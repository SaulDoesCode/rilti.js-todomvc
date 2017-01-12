(root => {
	'use strict';

	const ENTER_KEY = 13;

	const {dom, informer} = rot;
	const {query, queryAll, queryEach, li, div, input, label, button} = dom;

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

	const list = dom('ul.todo-list');
	const footer = dom('.todoapp > .footer'), todoCount = dom('span.todo-count');
	const UpdateCounter = () => {
		const num = todo.uncompleted;
		footer.class.toggle('hidden', todo.count == 0);
		todoCount.html = `<strong>${num}</strong> item${num != 1 ? 's' : ''} left`;
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
				const item_model = {state, msg};
				if(msg != value) item_model.value = value;
				State.todoItems = State.todoItems.filter(item => !!item).concat([item_model]);
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
		},
		create(state, msg, value) {
			msg = msg.trim();
			if(!value) value = msg;

				const base = li({
					props : {
						set state(newState) {
							this.class.toggle('completed', newState);
							if(newState) todo.completed += 1;
							else if(todo.completed > 0) todo.completed -= 1;
							todo.saveState(msg, (state = newState));
						},
						get state() {
							return state;
						}
					},
					lifecycle: {
						destroy(el) {
							if(el.state) todo.completed -= 1;
							todo.items.delete(el);
							todo.delete(msg);
						}
					}
				});

				const tlabel = label({
					on: {
						dblclick() {
							dom.once(root, 'click', e => {
								if(e.target != editor) delete base.class.editing;
							});
							base.class = 'editing';
							editor.focus();
						}
					}
				}, msg);

				const editor = input({
					props : {
						save() {
							let val = this.node.value.trim();
							if(val != '' && val != msg) {
								tlabel.inner(msg = val);
								delete base.class.editing;
								todo.save(state, msg);
							}
							return this;
						}
					},
					class:'edit',
					value,
					on: {
						keydown(e, el) {
							if(e.keyCode === ENTER_KEY) el.save();
						}
					}
				});

				const toggle = input({
					class:'toggle',
					attr : {
						type:'checkbox'
					},
					lifecycle : {
						mount(el) {
							if(state) base.state = el.checked = state;
							base.toggle = (newState = !el.checked) => {
								if(newState != base.state) base.state = el.checked = newState;
							}
						}
					},
					on : {
						change(e) {
							base.state = this.checked;
						}
					}
				});

				base.append(
					div({class: 'view'},
						toggle,
						tlabel,
						button({
							class:'destroy',
							on: {
								click: base.remove
							}
						})
					),
					editor
				).appendTo(list);

				todo.items.add(base);
				todo.save(state, msg, value);
		}
	}

	dom('input.new-todo').on.keydown = (e, el) => {
		if(e.keyCode === ENTER_KEY) {
			todo.create(false, el.value);
			el.value = '';
		}
	}

	dom('input.toggle-all').on.change((e,el) => todo.each(item => item.toggle(el.checked)));

	dom('.clear-completed').on.click = () => todo.each(item => {
		if(item.state) item.remove();
	});

	State.todoItems.forEach(item => todo.create(item.state, item.msg, item.value));

	const eachItem = fn => () => todo.each(fn);
	const showCompleted = eachItem(item => item.class.toggle('hidden', !item.state));
	const showUncompleted = eachItem(item => item.class.toggle('hidden', item.state));
	const showAll = eachItem(item => delete item.class.hidden);

	route('#/completed', showCompleted);
	route('#/active', showUncompleted);
	route('#/', showAll);

})(window);
