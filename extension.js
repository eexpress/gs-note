const { GObject, GLib, Gio, St, Clutter } = imports.gi;
//~ ExtensionUtils
const ExtensionUtils = imports.misc.extensionUtils;
const Me			 = ExtensionUtils.getCurrentExtension();
const _ 		     = ExtensionUtils.gettext;
//~ UI
const Main			 = imports.ui.main;
const PanelMenu		 = imports.ui.panelMenu;
const PopupMenu		 = imports.ui.popupMenu;
//~ User
const _domain = Me.metadata['gettext-domain'];
function lg(s) { log("===" + _domain + "===>" + s); }

let dirs = [];	//常用目录
let cmds = [];	//常用命令
let clip = [];	//纯粹的剪贴板信息
let cdir = '';	//当前目录

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _(Me.metadata['name']));
        this.settings = ExtensionUtils.getSettings();
//~ -----------------above standard templete--------------
		dirs = this.settings.get_strv('dirs');
		cmds = this.settings.get_strv('cmds');
		clip = this.settings.get_strv('clip');

		this.sets = [
			['inode-directory-symbolic', dirs, 'dirs'],
			['system-run-symbolic', cmds, 'cmds'],
			['notes-app-symbolic', clip, 'clip']
		];

        this.add_child(new St.Icon({
            icon_name: 'notes-app-symbolic',
            style_class: 'system-status-icon',
        }));

        const item = new PopupMenu.PopupImageMenuItem("Add Clip", 'list-add-symbolic');
        item.connect('activate', () => { this.get_clip(); });
        this.menu.addMenuItem(item);

        this.refresh_menu();
    }

    get_clip(){
		this._clipboard = St.Clipboard.get_default();
		this._clipboard.get_text(St.ClipboardType.PRIMARY, (clipboard, text) => {
			text = text.trim();
			if(text.length<3) return;
			let path = text;
			if (path.indexOf("~/") == 0) { path = GLib.get_home_dir() + path.substr(1); }
			if (GLib.file_test(path, GLib.FileTest.IS_DIR)) { this.add_data(text, 0); return; }
			const para = text.split('\ ');
			const r = GLib.find_program_in_path(para[0]);
			if (r) { this.add_data(text, 1); return;}
			this.add_data(text, 2);
		});
	}

	add_data(s){
		this.sets[s][1].push(text);
		this.settings.set_strv(this.sets[s][2], this.sets[s][1]);
		this.refresh_menu();
	};

	refresh_menu(){
		this.menu._getMenuItems().forEach((j) => {if(j.type) j.destroy(); });
		for (let i of dirs){this.add_menu(i, 0);}
		for (let i of cmds){this.add_menu(i, 1);}
		for (let i of clip){this.add_menu(i, 2);}
	};

	add_menu(text, s){
		lg(text);
		const item = new PopupMenu.PopupImageMenuItem(text, this.sets[s][0]);
		item.type = this.sets[s][2];
		item._icon.set_reactive(true);
		item._icon.connect('enter-event', (actor) => { item.setIcon('list-remove-symbolic'); });
		item._icon.connect('leave-event', (actor) => { item.setIcon(this.sets[s][0]); });
		item._icon.connect('button-release-event', (actor) => {
			this.sets[s][1].splice(this.sets[s][1].indexOf(item.text), 1);
			this.settings.set_strv(this.sets[s][2], this.sets[s][1]);
			item.destroy();
		});
		item.connect('activate', (actor, event) => {
			switch (item.type){
				case 'dirs':
					cdir = item.text;
					return Clutter.EVENT_STOP;
					break;
				case 'cmds':
					if (event.get_button() == 3) {
						GLib.spawn_command_line_async(`gnome-terminal --working-directory='${cdir}' -- bash -c '${item.text}; bash'`);
						//~ Util.spawn(['gnome-terminal', `--working-directory='${path}/${text}' -- bash -c 'git status; bash'`]); //no work correctly.
						return Clutter.EVENT_STOP;
					}
					GLib.chdir(cdir);
					GLib.spawn_command_line_async(`${item.text}`);
					return Clutter.EVENT_STOP;
				case 'clip':
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
