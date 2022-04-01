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
		this._clipboard = St.Clipboard.get_default();

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
		this._clipboard.get_text(St.ClipboardType.PRIMARY, (clipboard, text) => {
			text = text.trim();
			if(text.length<3) return;
			let path = text;
			if (path.indexOf("~/") == 0) { path = GLib.get_home_dir() + path.substr(1); }
			if (GLib.file_test(path, GLib.FileTest.IS_DIR)) { this.add_data(text, 'dirs'); return; }
			const para = text.split('\ ');
			const r = GLib.find_program_in_path(para[0]);
			if (r) { this.add_data(text, 'cmds'); return;}
			this.add_data(text, 'clip');
		});
	}

	add_data(text, s){
		lg(text);
		lg(s);
		const a = this.get_array_from_str(s);
		a.push(text);
		this.settings.set_strv(s, a);
		lg(s+": "+a);
		this.refresh_menu();
	};

	refresh_menu(){
		this.menu._getMenuItems().forEach((j) => {if(j.type) j.destroy(); });
		for (let i of dirs){this.add_menu(i, 0);}
		for (let i of cmds){this.add_menu(i, 1);}
		for (let i of clip){this.add_menu(i, 2);}
	};

	get_array_from_str(s){
		switch (s){
			case 'dirs':
				return dirs;
			case 'cmds':
				return cmds;
			case 'clip':
				return clip;
		}
	};

	add_menu(text, s){
		const sets = [
			['inode-directory-symbolic', 'dirs'],
			['system-run-symbolic', 'cmds'],
			['notes-app-symbolic', 'clip']
		];
		const item = new PopupMenu.PopupImageMenuItem(text, sets[s][0]);
		item.type = sets[s][1];
		item._icon.set_reactive(true);
		item._icon.connect('enter-event', (actor) => { item.setIcon('list-remove-symbolic'); });
		item._icon.connect('leave-event', (actor) => { item.setIcon(sets[s][0]); });
		item._icon.connect('button-release-event', (actor) => {
			const a = this.get_array_from_str(item.type);
			a.splice(a.indexOf(item.label.text), 1);
			lg(item.type+": "+a);
			this.settings.set_strv(sets[s][1], a);
			item.destroy();
		});
		item.connect('activate', (actor, event) => {
			const mtext = item.label.text;
			switch (item.type){
				case 'dirs':
					cdir = mtext;
					if (cdir.indexOf("~/") == 0) { cdir = GLib.get_home_dir() + cdir.substr(1); }
					switch(event.get_button()){
						case 1:
							Gio.app_info_launch_default_for_uri(`file://${cdir}`, global.create_app_launch_context(0, -1));
							return Clutter.EVENT_STOP;
						case 2:
							GLib.chdir(cdir);
							if(GLib.find_program_in_path('kgx')){
								GLib.spawn_command_line_async(`kgx`);
							} else if(GLib.find_program_in_path('gnome-terminal')){
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
					if(event.get_button() == 3){
						this._clipboard.set_text(St.ClipboardType.PRIMARY, mtext);
						return Clutter.EVENT_STOP;
					}
					GLib.chdir(cdir);
					if(GLib.find_program_in_path('kgx')){
						GLib.spawn_command_line_async(`kgx -e '${mtext}'`);
					} else if(GLib.find_program_in_path('gnome-terminal')){
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
