//===============================================================================================
// Core FMOD
//===============================================================================================

/**:
 * @target MZ
 * @plugindesc Bridges FMOD Studio with RPG Maker MZ
 * @author MagickaHat
 * @help CORE_FMOD.js
 */

(() => {
    class FMODBridge {
        constructor() {
            this.system = null;
        }

        init() {
        }

        update() {
            if (this.system) {
                this.system.update();
            }
        }

        playBackgroundMusic(eventName) {
        }

        playBackgroundSound(eventName) {
        }

        playMusicEffect(eventName) {
        }

        playSoundEffect(eventName) {
        }
    }
})();