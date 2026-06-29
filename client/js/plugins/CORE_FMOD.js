//===============================================================================================
// Atomical Garden - Core FMOD
//===============================================================================================

/*:
 * @target MZ
 * @plugindesc Bridges FMOD Studio with RPG Maker MZ.
 * @author MagickaHat
 * @help CORE_FMOD.js
 */

var FMOD = {};

(() => {
    class FMODBridge {
        constructor() {
            this.BankList = ['BGM', 'BGS', 'Master', 'Master.strings', 'ME', 'SE'];
            this.BankAssets =
                this.BankList.map(name => name.endsWith('.bank') ? name : (name + '.bank'));

            this.GUIDsPath = 'audio/bank';

            this.VCA_BGM = 'BGM';
            this.VCA_BGS = 'BGS';
            this.VCA_ME = 'ME';
            this.VCA_SE = 'SE';

            this.QueuedPauseBGMs = null;
            this.QueuedPauseBGSs = null;
            this.QueuedPauseBGMsByME = null;

            this.VCA_BGM_VOLUME = 1;
            this.VCA_BGS_VOLUME = 1;
            this.VCA_ME_VOLUME = 1;
            this.VCA_SE_VOLUME = 1;

            this.MaximumHeapSize = 64 * 1024 * 1024;

            this.EventType = {None: 0, BGM: 1, BGS: 2, ME: 3, SE: 4};

            this.EventTypeValues = Object.values(this.EventType);

            this.LISTENER_CAMERA = 0;

            this.Initialized = false;
            this.IsAudioResumed = false;

            this.FGlobalSystem = null;
            this.FGlobalSystemCore = null;
            this.FBanks = null;

            this.ListenerAttributes = [];
            this.MaximumInstanceCount = 200;
        }

        onPreRun() {
            var bankAssets = this.BankAssets;
            var canRead = true;
            var canWrite = false;

            for (var bankAsset of bankAssets)
                FMOD.FS_createPreloadedFile(
                    '/', bankAsset, this.BankList + '/' + bankAsset, canRead, canWrite);
        }

        init() {
            var ptr_out = {};
            var result;

            result = FMOD.Studio_System_Create(ptr_out);
            console.log(result);

            var globalSystem = this.FGlobalSystem = ptr_out.val;

            result = globalSystem.getCoreSystem(ptr_out);
            console.log(result);

            var globalSystemCore = this.FGlobalSystemCore = ptr_out.val;

            result = globalSystemCore.setDSPBufferSize(2048, 2);
            console.log(result);

            this.Start();

            this.registerListeners();
            console.log(this.FGlobalSystemCore.mixerResume());
            this.IsAudioResumed = true;

            if (typeof OutputAudioWorklet_resumeAudio === 'function')
                OutputAudioWorklet_resumeAudio();

            this.Initialized = true;
        }

        registerListeners() {
            document.addEventListener('keydown', this.resumeAudio.bind(this));
            document.addEventListener('mousedown', this.resumeAudio.bind(this));
            document.addEventListener('touchend', this.resumeAudio.bind(this), false);
            document.addEventListener('touchstart', this.resumeAudio.bind(this));
            document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
            document.addEventListener('blur', this.onBlur.bind(this));
            document.addEventListener('focus', this.onFocus.bind(this));

            if (!Utils.isNwjs()) return;

            var window = nw.Window.get();

            if (window._this_onFocus) window.removeListener('focus', window._this_onFocus);

            if (window._this_onBlur) window.removeListener('blur', window._this_onBlur);

            window._this_onFocus = this.onFocus.bind(this);
            window._this_onBlur = this.onBlur.bind(this);
        }

        vector(x, y, z, to) {
            if (!to) to = {};

            to.x = x;
            to.y = y;
            to.z = z;

            return to;
        }

        create3DAttributes(x, y, z) {
            var attributes = FMOD._3D_ATTRIBUTES();

            this.vector(x || 0, y || 0, z || 0, attributes.position);
            this.vector(0, 0, 0, attributes.velocity);
            this.vector(0, 0, 1, attributes.forward);
            this.vector(0, 1, 0, attributes.up);

            return attributes;
        }

        setListenerPosition(id, x, y, z) {
            if (id < 0) throw new Error('Invalid listener id');

            if (!this.ListenerAttributes[id])
                this.ListenerAttributes[id] = this.create3DAttributes(x, y, z);

            var attributes = this.ListenerAttributes[id];

            this.vector(x, y, z, attributes.position);
            console.log(this.FGlobalSystem.setListenerAttributes(id, attributes, null));
        }

        start() {
            this.InstantiatedEvents = {
                [this.EventType.None]: {},
                [this.EventType.BGM]: {},
                [this.EventType.BGS]: {},
                [this.EventType.ME]: {},
                [this.EventType.SE]: {}
            };

            this.setListenerPosition(this.LISTENER_CAMERA, 0, 0, 0);
            this.GlobalSpeaker = new this.GlobalSpeaker({x: 0, y: 0});

            this.Temp3DAttributes = this.create3DAttributes();

            this.FBanks = {};
            var bankAssets = this.BankAssets;
            var bank;

            for (var bankAsset of bankAssets) {
                bank = this.loadBank(bankAsset);
                this.FBanks[bankAsset] = bank;

                if (bankAsset.endsWith('.strings.bank')) this.gatherAllStrings(bankAsset, bank);
            }

            this.VCA_BGM = this.getVCA(this.VCA_BGM);
            this.VCA_BGS = this.getVCA(this.VCA_BGS);
            this.VCA_ME = this.getVCA(this.VCA_ME);
            this.VCA_SE = this.getVCA(this.VCA_SE);

            if (!this.VCA_BGM)
                console.warn(
                    'FMOD couldn\'t find VCA for BGM, volume for BGM channel will be ignored.');
            if (!this.VCA_BGS)
                console.warn(
                    'FMOD couldn\'t find VCA for BGS, volume for BGS channel will be ignored.');
            if (!this.VCA_ME)
                console.warn(
                    'FMOD couldn\'t find VCA for ME, volume for ME channel will be ignored.');
            if (!this.VCA_SE)
                console.warn(
                    'FMOD couldn\'t find VCA for SE, volume for SE channel will be ignored.');

            this.setBGMVolume(AudioManager.bgmVolume);
            this.setBGSVolume(AudioManager.bgsVolume);
            this.setMEVolume(AudioManager.meVolume);
            this.setSEVolume(AudioManager.seVolume);

            this.Snapshots = this.loadAllSnapshots();
        }

        getVCA(guid) {
            if (!(guid instanceof Guid)) return null;

            var ptr_out = {};

            try {
                console.log(this.FGlobalSystem.getVCAByID(guid, ptr_out));
            } catch (error) {
                return null;
            }

            return ptr_out.val;
        }
    }
})();