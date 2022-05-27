const { GObject, GLib, Gio, St, Clutter } = imports.gi;
//~ ExtensionUtils
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const _ = ExtensionUtils.gettext;
//~ UI
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
//~ User
const _domain = Me.metadata['gettext-domain'];
function lg(s) { log("===" + _domain + "===>" + s); }
//~ Global Variable
let dirs = [];	//常用目录
let cmds = [];	//常用命令
let clip = [];	//纯粹的剪贴板信息
let cdir = '';	//当前目录
let last = '';	//最后一个剪贴板文本

const Indicator = GObject.registerClass(
	class Indicator extends PanelMenu.Button {
		_init() {
			super._init(0.0, _(Me.metadata['name']));
			this.settings = ExtensionUtils.getSettings();
			//~ -----------------above standard templete--------------
			dirs = this.settings.get_strv('dirs');
			cmds = this.settings.get_strv('cmds');
			clip = this.settings.get_strv('clip');
			this._clipboard = St.Clipboard.get_default();

			this.add_child(new St.Icon({
				icon_name : 'edit-paste-symbolic',
				style_class : 'system-status-icon',
			}));

			this.menu.connect('open-state-changed', (menu, open) => {
				if (open) { this.get_clip(); }
			});

			this.refresh_menu();
		}

		get_clip() {
			this._clipboard.get_text(St.ClipboardType.PRIMARY, (clipboard, text) => {
				if (!text) return;	// text is null
				if (text == last) return;
				text = text.trim();
				if (text.length < 3) return;
				if (GLib.file_test(this.get_path(text), GLib.FileTest.IS_DIR)) {
					this.add_data(text, 'dirs');
					return;
				}
				const para = text.split('\ ');
				const r = GLib.find_program_in_path(para[0]);  // need judge `alias`
				if (r) {
					this.add_data(text, 'cmds');
					return;
				}
				this.add_data(text, 'clip');
			});
		}

		get_path(text) {
			if (text.indexOf("~/") == 0) { text = GLib.get_home_dir() + text.substr(1); }
			return text;
		};

		add_data(text, s) {
			const a = this.get_array_from_str(s);
			if (a.indexOf(text) >= 0) return;
			a.push(text);
			last = text;
			this.settings.set_strv(s, a);
			this.refresh_menu();
		};

		refresh_menu() {
			//~ this.menu._getMenuItems().forEach((j) => {if(j._type) j.destroy(); });
			this.menu._getMenuItems().forEach(j => { j.destroy(); });
			const item0 = new PopupMenu.PopupMenuItem('❶ 📂    ❷🖥    ❸📋 ');
			this.menu.addMenuItem(item0);
			for (let i of dirs) { this.add_menu(i, 0); }
			const l0 = new PopupMenu.PopupSeparatorMenuItem();
			this.menu.addMenuItem(l0);
			const item1 = new PopupMenu.PopupMenuItem('❶ ❷🖥    ❸📋 ');
			this.menu.addMenuItem(item1);
			for (let i of cmds) { this.add_menu(i, 1); }
			const l1 = new PopupMenu.PopupSeparatorMenuItem();
			this.menu.addMenuItem(l1);
			for (let i of clip) { this.add_menu(i, 2); }
		};

		get_array_from_str(s) {
			switch (s) {
			case 'dirs':
				return dirs;
			case 'cmds':
				return cmds;
			case 'clip':
				return clip;
			}
		};

		add_menu(text, s) {
			const sets = [
				[ 'folder-symbolic', 'dirs' ],
				[ 'system-run-symbolic', 'cmds' ],
				[ 'edit-paste-symbolic', 'clip' ]
			];
			let dicon;
			if (s === 0) {	// dirs
				if (!cdir) {  //缺省第一个目录。
					cdir = text;
					GLib.chdir(this.get_path(cdir));  //赋值就立刻改目录。
				}
				if (cdir == text) dicon = 'emblem-ok-symbolic';
			}
			let _lstr = text;
			if (text.length > 150) { _lstr = text.substr(0, 150) + '...'; }
			const item = new PopupMenu.PopupImageMenuItem(_lstr, dicon ?? sets[s][0]);
			item._text = text;  // append attr
			item._type = sets[s][1];	 // append attr
			item._icon.set_reactive(true);
			item._icon.connect('enter-event', (actor) => { item.setIcon('list-remove-symbolic'); });
			item._icon.connect('leave-event', (actor) => { item.setIcon(dicon ?? sets[s][0]); });
			item._icon.connect('button-release-event', (actor) => {
				const a = this.get_array_from_str(item._type);
				a.splice(a.indexOf(item.label.text), 1);
				this.settings.set_strv(sets[s][1], a);
				item.destroy();
			});
			item.connect('activate', (actor, event) => {
				//~ const mtext = item.label.text;
				const mtext = item._text;
				switch (item._type) {
				case 'dirs':
					cdir = mtext;
					GLib.chdir(this.get_path(cdir));  //赋值就立刻改目录。
					this.refresh_menu();  //刷新当前目录的图标
					switch (event.get_button()) {
					case 1:
						Gio.app_info_launch_default_for_uri(`file://${this.get_path(cdir)}`, global.create_app_launch_context(0, -1));
						return Clutter.EVENT_STOP;
					case 2:
						if (GLib.find_program_in_path('kgx')) {
							GLib.spawn_command_line_async(`kgx`);
						} else if (GLib.find_program_in_path('gnome-terminal')) {
							GLib.spawn_command_line_async(`gnome-terminal`);
						} else {
							Main.notify(_("Not kgx(gnome-console) or gnome-terminal found."));
						}
						return Clutter.EVENT_STOP;
					case 3:
						this._clipboard.set_text(St.ClipboardType.PRIMARY, mtext);
						return Clutter.EVENT_STOP;
					}
					return Clutter.EVENT_STOP;
				case 'cmds':
					if (event.get_button() == 3) {
						this._clipboard.set_text(St.ClipboardType.PRIMARY, mtext);
						return Clutter.EVENT_STOP;
					}
					if (GLib.find_program_in_path('kgx')) {
						GLib.spawn_command_line_async(`kgx -e '${mtext}'`);
					} else if (GLib.find_program_in_path('gnome-terminal')) {
						GLib.spawn_command_line_async(`gnome-terminal -- bash -c '${mtext}; bash'`);
					} else {
						Main.notify(_("Not gnome-console(kgx) or gnome-terminal found."));
					}
					return Clutter.EVENT_STOP;
				case 'clip':
					this._clipboard.set_text(St.ClipboardType.PRIMARY, mtext);
					return Clutter.EVENT_STOP;
				}
			});
			this.menu.addMenuItem(item);
		};
	});

class Extension {
	constructor(uuid) {
		this._uuid = uuid;

		ExtensionUtils.initTranslations();
	}

	enable() {
		this._indicator = new Indicator();
		Main.panel.addToStatusArea(this._uuid, this._indicator);
	}

	disable() {
		this._indicator.destroy();
		this._indicator = null;
	}
}

function init(meta) {
	return new Extension(meta.uuid);
}
