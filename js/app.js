(root => {
	'use strict';

	const ENTER_KEY = 13;

	const {dom, evtsys} = rot;
	const {query, queryAll, queryEach, li, div, input, label, button, on} = dom;

	const router = evtsys();
	on(root, 'hashchange', () => router.has(location.hash) ? router.emit(location.hash) : router.emit('default', location.hash));
	const route = (hash, fn) => {
	  if(location.hash == hash) fn();
	  return router.on(hash, fn);
	}
	route.default = fn => router.on('default', fn);

	const Store = name => {
			let val = localStorage.getItem(name);
			const store = rot.isStr(val) ? JSON.parse(val) : {}, inf = evtsys();
			return new Proxy(store, {
						get(obj, key) {
								if (key in inf) return inf[key];
								inf.emit('get', key);
								return obj[key];
						},
						set(obj, key, val) {
								if (val != obj[key]) {
									obj[key] = val;
									inf.emit('set', key, val);
									localStorage.setItem(name, JSON.stringify(obj));
									return val;
								}
						},
						deleteProperty(obj, key) {
								delete obj[key];
								inf.emit('delete', key);
								localStorage.setItem(name, JSON.stringify(obj));
						}
		});
	}

	const State = window.State = Store('todo-list');
	if(!rot.isArr(State.todoItems)) State.todoItems = [];

	const list = dom('ul.todo-list');
	const footer = dom('.todoapp > .footer'), todoCount = dom('span.todo-count');
	const UpdateCounter = () => {
		const num = todo.uncompleted;
		footer.class('hidden', todo.count == 0);
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
							this.class('completed', newState);
							if(location.hash.includes('completed') && !this.class.completed) this.class = 'hidden';
							else delete this.class.hidden;
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
							let val = this.value.trim();
							if(val != '' && val != msg) {
								todo.delete(msg);
								tlabel.inner(msg = val);
								base.class.remove = 'editing';
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
						change(e, el) {
							base.state = el.checked;
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

	dom('.clear-completed').on.click = () => todo.each(item => item.state && item.remove());

	State.todoItems.forEach(item => todo.create(item.state, item.msg, item.value));

	const filters = new Set;
	queryEach('ul.filters > li > a', filter => filters.add(dom(filter)));

	const eachItem = fn => () => {
		todo.each(fn);
		filters.forEach(filter => filter.class('selected', filter.attr.href == location.hash));
	}

	const showCompleted = eachItem(item => item.class('hidden', !item.state)),
				showUncompleted = eachItem(item => item.class('hidden', item.state)),
				showAll = eachItem(item => item.class('hidden', false));

	route('#/completed', showCompleted);
	route('#/active', showUncompleted);
	route.default(showAll);

})(window);
