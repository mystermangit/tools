import utils from '../../utils/utils';

import './Player.css';

const lrcModeReg = /player-lrc-mode-[0-9]+/g;

class Player{
    constructor(id){
        let box = document.querySelector(id);
        if(box){
            this.lrcData = null;
            this.lrcKeys = null;
            this.lrcLen = 0;
            this.showLrcLines = 7;

            this.__define__('xhr', {
                value: new XMLHttpRequest()
            });
            this.__define__('timer', {
                writable: true,
                value: 0
            });
            this.__dom__();
            this.__obs__();

            box.appendChild(this[0]);
            this.__events__();
            this.volume = .5;

            this.__define__('private', {
                value: 1
            });
        }
    }
    __dom__(){
        Player.__check__(this.private, '__dom__');
        this[0] = document.createElement('div');
        this[0].className = 'player player-1';
        this[0].innerHTML = `
        <video data-name="video" class="player-video"></video>
        <div data-name="lrc" class="player-lrc"></div>
        <div data-name="ctrls" class="player-controls">
            <div class="player-slider" title="播放时间滑块">
                <div data-name="buf" class="player-slider-buf"></div>
                <div data-name="thumb" class="player-slider-thumb"></div>
            </div>
            <div class="player-toolbar">
                <div class="player-toolbar-left">
                    <div data-name="btn" class="player-btn" title="播放/暂时"></div>
                    <div data-name="cur" class="player-current-time">--:--</div>
                    <div data-name="dur" class="player-duration">/ --:--</div>
                </div>
                <div class="player-toolbar-right">
                    <div data-name="vbtn" class="player-vol-btn" title="音量">
                        <i class="player-vol-rect"></i>
                        <i class="player-vol-tri"></i>
                        <i class="player-vol-stat">
                            <i class="player-vol-dot1"></i>
                            <i class="player-vol-dot2"></i>
                            <i class="player-vol-dot3"></i>
                            <i class="player-vol-mute">&times;</i>
                        </i>
                        <div class="player-vol-slidebar">
                            <div class="player-vol-slide-track">
                                <div data-name="vslider" class="player-vol-slider"></div>
                            </div>
                        </div>
                    </div>
                    <div data-name="rate" class="player-rate" title="播放速率">1x</div>
                    <div data-name="fscreen" class="player-fullscreen" title="全屏切换">
                        <i class="player-fullscreen-tl"></i>
                        <i class="player-fullscreen-tr"></i>
                        <i class="player-fullscreen-bl"></i>
                        <i class="player-fullscreen-br"></i>
                    </div>
                </div>
            </div>
        </div>`;

        this.els = {
            loading: document.createElement('div')
        };

        this.els.loading.className = 'r-loading';

        for(let els = this[0].querySelectorAll('[data-name]'),
                len=els.length,
                i=0;
            i<len; i++){
            this.els[els[i].getAttribute('data-name')] = els[i];
            els[i].removeAttribute('data-name');
        }
    }
    __define__(name, obj){
        Player.__check__(this.private, '__define__');
        Object.defineProperty(this, name, obj);
    }
    __ob__(attr, fn){
        Player.__check__(this.private, '__ob__');
        let oval;
        this.__define__(attr, {
            set(val){
                if(val !== oval){
                    oval = val;
                    fn(val);
                }
            },
            get(){return oval;}
        });
    }
    __obs__(){
        Player.__check__(this.private, '__obs__');
        let _this = this;

        _this.__ob__('src', val=>{
            _this.lrc = '';
            _this.lrcData = null;
            _this.lrcKeys = null;
            _this.lrcLen = 0;
            _this.poster = '';
            _this.els.video.src = val;
        });

        _this.__ob__('poster',val=>{
            if(!val){
                _this.els.video.removeAttribute('poster');
            }else{
                _this.els.video.poster = val;
            }
        });

        _this.__ob__('currentTime', val=>{
            _this.els.cur.innerText = utils.timemat(val);
            _this.els.thumb.style.width = (val / _this.duration) * 100 + '%';
            _this.getLrcActive(val);
        });

        _this.__ob__('volume', val=>{
            _this.els.video.volume = val;
            _this.els.vslider.style.height = val * 100 + '%';
        });

        _this.__ob__('activeIndex', ()=>{
            _this.renderLrc();
        });
    }
    __events__(){
        Player.__check__(this.private, '__events__');
        let _this = this,
            video = _this.els.video,
            btn = _this.els.btn,
            loading = _this.els.loading;

        utils.on(window, 'resize', function () {
            _this.setLrcMode();
        });

        utils.on(video, 'loadstart', function () {
            _this[0].appendChild(loading);
        });

        utils.on(video, 'durationchange', function(){
            _this.duration = this.duration;
            _this.currentTime = 0;
            _this.els.dur.innerText = '/ ' + utils.timemat(this.duration);
            _this.els.video.playbackRate = parseFloat(_this.els.rate.innerText);
            _this.loadLrc();
        });

        utils.on(video, 'loadeddata', function () {
            _this[0].removeChild(loading);
        });

        utils.on(video, 'error', function () {
            loading.innerHTML = '加载失败';
            utils.addClass(loading, 'r-loadend');
            utils.removeClass(loading, 'r-loading');
        });

        utils.on(btn, 'click', function(){
            if(video.paused){
                video.play();
                video.autoplay = true;
                utils.addClass(btn, 'player-btn-playing');
            }else{
                video.pause();
                video.autoplay = false;
                utils.removeClass(btn, 'player-btn-playing');
            }
        });

        utils.on(video, 'timeupdate', function () {
            try{
                _this.els.buf.style.width = (video.buffered.end(video.buffered.length-1) / this.duration) * 100 + '%';
            }catch (err){}
            _this.currentTime = this.currentTime;
        });

        utils.on(_this.els.thumb.parentNode, 'click', function(e){
            if(video.duration > 0){
                let percent = e.offsetX / this.offsetWidth;
                _this.currentTime = percent * video.duration;
                video.currentTime = Math.round(percent * video.duration);
            }
        });

        utils.on(_this.els.vslider.parentNode, 'click',function(e){
            let info = this.getBoundingClientRect();
            _this.volume = (info.bottom - e.clientY)/info.height;
        });

        utils.on(_this.els.vbtn, 'click', function (e) {
            if(!_this.els.vslider.parentNode.parentNode.contains(e.target)){
                if(video.muted = !video.muted){
                    utils.addClass(_this[0], 'player-muted');
                }else{
                    utils.removeClass(_this[0], 'player-muted');
                }
            }
        },true);

        utils.on(_this.els.rate, 'click', function(){
            let rate = parseFloat(this.innerText);
            rate += .25;
            if(rate > 2) rate = .25;
            _this.els.video.playbackRate = rate;
            this.innerText = rate+'x';
        });

        utils.on(_this.els.fscreen, 'click', function(){
            if(utils.isFullscreen()){
                utils.exitFullscreen();
                utils.removeClass(_this.els.fscreen, 'player-fullscreen-on');
            }else{
                utils.fullscreen(_this[0]);
                utils.addClass(_this.els.fscreen, 'player-fullscreen-on');
            }
        });

        utils.on(_this[0], 'mousemove', function(e){
            if(_this.timer) clearTimeout(_this.timer);

            if(!_this.els.ctrls.contains(e.target)){
                _this.showMouse();
                _this.timer = setTimeout(()=>{_this.hideMouse()}, 2000);
            }
        });

        utils.on(_this[0], 'mouseleave', ()=>{_this.hideMouse()});
    }
    showMouse(){
        clearTimeout(this.timer);
        this[0].style.cursor = 'default';
        utils.addClass(this.els.ctrls, 'player-controls-show');
    }
    hideMouse(){
        clearTimeout(this.timer);
        this[0].style.cursor = 'none';
        utils.removeClass(this.els.ctrls, 'player-controls-show');
    }
    loadLrc(){
        let _this = this;
        _this.els.lrc.innerHTML = '';
        if(!this.lrc) return;
        this.xhr.open('get', this.lrc, true);
        _this.xhr.onreadystatechange = function(){
            if(_this.xhr.readyState === 4){
                let txt = '[00:00.00]找不到歌词/字幕';
                if(_this.xhr.status === 200) {
                    txt = _this.xhr.responseText;
                }
                _this.readLrc(txt);
                _this.showLrc();
                _this.setLrcMode();
            }
        };
        _this.xhr.send();
    }
    readLrc(lrcText){
        let _this = this,
            lines;

        if(!lrcText) return;

        lines = lrcText.split(/\n+/);
        _this.lrcData = {};

        lines.forEach(line=>{
            line.replace(/\[([0-9:.\[\]]+)\]/ig, function(txt,$1){
                txt = line.slice(line.lastIndexOf(']')+1).replace(/\s+/g,'');
                if(txt){
                    for(let keys = $1.split(/\]\s*\[/), len = keys.length, i = 0; i<len; i++){
                        let key = utils.time(keys[i]);
                        if(_this.lrcData[key]){
                            _this.lrcData[key] += '<br>'+txt;
                        }else{
                            _this.lrcData[key] = txt;
                        }
                    }
                }
            });
        });
        lrcText = null;
        lines = null;
        _this.lrcKeys = Object.keys(_this.lrcData);
        _this.lrcKeys.sort(function(a, b){
            return Number(a) - Number(b);
        });
        _this.lrcLen = _this.lrcKeys.length;
        _this.activeIndex = 0;
    }
    getLrcActive(curtime){
        for(let i=0; i<this.lrcLen; i++){
            let delta = parseFloat(this.lrcKeys[i]) - curtime;
            if(delta >= 0){
                if(this.lrcKeys[i-1])
                    this.activeIndex = i-1;
                break;
            }
        }
    }
    showLrc(){
        utils.addClass(this.els.lrc, 'player-lrc-show');
    }
    hideLrc(){
        utils.removeClass(this.els.lrc, 'player-lrc-show');
    }
    renderLrc(){
        if(this.lrcMode === 1){
            this.els.lrc.innerHTML = '';
            let lines = this.showLrcLines,
                half = Math.floor(lines/2),
                delta = Math.round(100/(half+1));

            for(let j=0, idx=0, opc=delta; j<lines; j++){
                idx = this.activeIndex+j-half;
                if(idx <= this.activeIndex){
                    opc += delta;
                }else{
                    opc -= delta;
                }
                if(this.lrcKeys[idx]){
                    this.els.lrc.innerHTML += '<div class="player-lrc-line'+(idx === this.activeIndex ? ' player-lrc-line-active' : '')+'" style="opacity: '+(opc-delta)/100+';">'+this.lrcData[this.lrcKeys[idx]]+'</div>';
                }
            }
        }else{
            this.els.lrc.innerHTML = '<div class="player-lrc-line player-lrc-line-active">'+this.lrcData[this.lrcKeys[this.activeIndex]]+'</div>';
        }
    }
    setLrcMode(lrcMode){
        if(typeof lrcMode === 'number'){
            this.lrcMode = lrcMode;
        }
        if(this.lrcKeys) this.renderLrc();

        if(lrcModeReg.test(this.els.lrc.className)){
            this.els.lrc.className = this.els.lrc.className.replace(lrcModeReg, 'player-lrc-mode-'+(this.lrcMode || 0));
        }else{
            this.els.lrc.className += ' player-lrc-mode-'+(this.lrcMode || 0);
        }

        let lrcLine = this.els.lrc.children[0],
            lh = 32,
            lrcTop;
        if(lrcLine){
            lh = lrcLine.offsetHeight + (Number(utils.calced(lrcLine,'lineHeight')) || 0);
        }
        if(this.lrcMode === 1){
            lrcTop = (this[0].offsetHeight - lh*this.showLrcLines)/2;
        }else{
            lrcTop = this[0].offsetHeight - lh*2;
        }
        utils.transform(this.els.lrc, 'translateY('+lrcTop+'px)');
    }
    setLrcLines(num){
        if(typeof num === 'number'){
            this.showLrcLines = num;
            if(this.lrcMode === 1) this.setLrcMode();
        }
    }
    static __check__(code, name){
        if(code === 1) throw TypeError(name+'是私有方法，不可调用');
    }
    static toString(){
        return '{ [ class Player ] }';
    }
}
export default Player;