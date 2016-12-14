/* global SendMessage, THREE */
(function () {
  var btnFsEnter = document.querySelector('#btnFsEnter');
  var btnVrToggle = document.querySelector('#btnVrToggle');
  var btnVrReset = document.querySelector('#btnVrReset');
  var canvas = document.querySelector('#canvas');
  var eyeParamsL;
  var eyeParamsR;
  var fullscreen = new Fullscreen();
  var isSupported = 'getVRDisplays' in navigator;
  var frameReady = false;
  var vrFrameData = window.VRFrameData ? new VRFrameData() : null;
  var vrDisplay;
  var vrPose;

  if (isSupported) {
    document.body.dataset.supportsVr = 'true';
    document.body.dataset.supportsVrChromium = 'chrome' in window && 'getVRDisplays' in navigator;
  }

  btnFsEnter.addEventListener('click', btnFsEnterOnClick);
  btnVrToggle.addEventListener('click', btnVrToggleOnClick);
  btnVrReset.addEventListener('click', btnVrResetOnClick);

  function btnFsEnterOnClick () {
    // FYI: Unity's `SetFullscreen` doesn't call the unprefixed Fullscreen API.
    fullscreen.enter(canvas);
  }

  function toggleFs () {
    if (fullscreen.isPresenting()) {
      fullscreen.enter(canvas);
    } else {
      fullscreen.exit();
    }
  }

  function btnVrToggleOnClick () {
    btnVrToggle.blur();
    if (vrDisplay) {
      togglePresent();
    } else {
      console.warn('[vrToggle] No VR device was detected');
    }
  }

  function btnVrResetOnClick () {
    btnVrReset.blur();
    if (vrDisplay) {
      resetPose();
    } else {
      console.warn('[btnVrResetOnClick] No VR device was detected');
    }
  }

  function shouldCaptureKeyEvent (e) {
    if (e.shiftKey || e.metaKey || e.altKey || e.ctrlKey) {
      return false;
    }
    return document.activeElement === document.body;
  }

  function initUnityLoaded () {
    document.body.dataset.unityLoaded = 'true';
  }

  function initVrLoaded () {
    if (vrDisplay.capabilities.canPresent) {
      document.body.dataset.vrLoaded = 'true';
    }
  }

  function initFsEventListeners () {
    window.addEventListener('keyup', function (e) {
      if (!shouldCaptureKeyEvent(e)) {
        return;
      }
      if (e.keyCode === 70) {  // `f`.
        if (isSupported) {
          togglePresent();
        } else {
          toggleFs();
        }
      }
    });
  }

  function initVrEventListeners () {
    window.addEventListener('keyup', function (e) {
      if (!shouldCaptureKeyEvent(e)) {
        return;
      }
      if (e.keyCode === 27) {  // `Esc`.
        exitPresent();
      }
      if (e.keyCode === 90) {  // `z`.
        resetPose();
      }
    });
    window.addEventListener('vrdisplaypresentchange', modeChange);
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('beforeunload', exitPresent);
  }

  function Fullscreen (element) {
    element = element || document.body;
    this.isSupported = true;
    if (element.requestFullscreen) {
      this.element = 'fullscreenElement';
      this.eventChange = 'fullscreenchange';
      this.methodEnter = 'requestFullscreen';
      this.methodExit = 'exitFullscreen';
    } else if (element.mozRequestFullScreen) {
      this.element = 'mozFullScreenElement';
      this.eventChange = 'mozfullscreenchange';
      this.methodEnter = 'mozRequestFullScreen';
      this.methodExit = 'mozCancelFullScreen';
    } else if (element.webkitRequestFullscreen) {
      this.element = 'webkitFullscreenElement';
      this.eventChange = 'webkitfullscreenchange';
      this.methodEnter = 'webkitRequestFullscreen';
      this.methodExit = 'webkitExitFullscreen';
    } else if (element.msRequestFullscreen) {
      this.element = 'msFullscreenElement';
      this.eventChange = 'MSFullscreenChange';
      this.methodEnter = 'msRequestFullscreen';
      this.methodExit = 'msExitFullscreen';
    } else {
      this.isSupported = false;
    }
    this.isPresenting = function () {
      return !!document[this.element];
    }.bind(this);
    this.enter = function (element, options) {
      return element[this.methodEnter](options);
    }.bind(this);
    this.exit = function () {
      return document[this.methodExit]();
    }.bind(this);
  }

  function raf (cb) {
    if (!vrDisplay) {
      return;
    }
    if (vrDisplay.requestAnimationFrame) {
      return vrDisplay.requestAnimationFrame(cb);
    } else {
      return window.requestAnimationFrame(cb);
    }
  }

  function getDisplays () {
    if (navigator.getVRDisplays) {
      isSupported = true;
      return navigator.getVRDisplays().then((devices) => { vrDisplay = devices[0]; });
    } else {
      throw 'Your browser is not VR ready';
    }
  }

  function getEyeParameters () {
    if (!vrDisplay) {
      console.warn('[getEyeParameters] No VR device was detected');
      return;
    }

    if (vrFrameData) {
      SendMessage('WebVRCameraSet', 'eyeL_projectionMatrix', vrFrameData.leftProjectionMatrix.join(','));
      SendMessage('WebVRCameraSet', 'eyeR_projectionMatrix', vrFrameData.rightProjectionMatrix.join(','));
    } else {
      eyeParamsL = vrDisplay.getEyeParameters('left');
      eyeParamsR = vrDisplay.getEyeParameters('right');

      var eyeTranslationL = eyeParamsL.offset[0];
      var eyeTranslationR = eyeParamsR.offset[0];
      var eyeFOVL = eyeParamsL.fieldOfView;
      var eyeFOVR = eyeParamsR.fieldOfView;

      SendMessage('WebVRCameraSet', 'eyeL_translation_x', eyeTranslationL);
      SendMessage('WebVRCameraSet', 'eyeR_translation_x', eyeTranslationR);
      SendMessage('WebVRCameraSet', 'eyeL_fovUpDegrees', eyeFOVL.upDegrees);
      SendMessage('WebVRCameraSet', 'eyeL_fovDownDegrees', eyeFOVL.downDegrees);
      SendMessage('WebVRCameraSet', 'eyeL_fovLeftDegrees', eyeFOVL.leftDegrees);
      SendMessage('WebVRCameraSet', 'eyeL_fovRightDegrees', eyeFOVL.rightDegrees);
      SendMessage('WebVRCameraSet', 'eyeR_fovUpDegrees', eyeFOVR.upDegrees);
      SendMessage('WebVRCameraSet', 'eyeR_fovDownDegrees', eyeFOVR.downDegrees);
      SendMessage('WebVRCameraSet', 'eyeR_fovLeftDegrees', eyeFOVR.leftDegrees);
      SendMessage('WebVRCameraSet', 'eyeR_fovRightDegrees', eyeFOVR.rightDegrees);
    }
  }

  function togglePresent () {
    if (!vrDisplay) {
      return;
    }
    if (isPresenting()) {
      return exitPresent();
    } else {
      return requestPresent();
    }
  }

  function resetPose () {
    if (!vrDisplay) {
      return;
    }
    return vrDisplay.resetPose();
  }

  function getFrameData () {
    if (!vrDisplay) {
      return;
    }
    vrDisplay.getFrameData(vrFrameData);
    return vrFrameData;
  }

  function getPose () {
    if (vrFrameData) {
      vrFrameData.pose
    }
    else if (vrDisplay) {
      vrDisplay.getPose()
    }
  }

  function requestPresent () {
    return vrDisplay.requestPresent([{source: canvas}]);
  }

  function exitPresent () {
    if (!isPresenting()) {
      return;
    }
    return vrDisplay.exitPresent();
  }

  function isPresenting () {
    if (!vrDisplay) {
      return false;
    }
    return vrDisplay.isPresenting;
  }

  function getVRSensorState () {
    getFrameData();
    vrPose = getPose();
    if (!vrPose || vrPose.orientation === null) {
      return;
    }
    var quaternion = new THREE.Quaternion().fromArray(vrPose.orientation);
    var euler = new THREE.Euler().setFromQuaternion(quaternion);
    SendMessage('WebVRCameraSet', 'euler_x', euler.x);
    SendMessage('WebVRCameraSet', 'euler_y', euler.y);
    SendMessage('WebVRCameraSet', 'euler_z', euler.z);
    if (vrPose.position !== null) {
      var positionX = vrPose.position[0];
      var positionY = vrPose.position[1];
      var positionZ = vrPose.position[2];
      SendMessage('WebVRCameraSet', 'position_x', positionX);
      SendMessage('WebVRCameraSet', 'position_y', positionY);
      SendMessage('WebVRCameraSet', 'position_z', positionZ);
    }
  }

  function resizeCanvas () {
    if (isPresenting()) {
      // TODO: Find a way to get this in the 1.1 API
      if (vrFrameData && vrDisplay.displayName == 'Oculus Rift CV1, Oculus VR') {
        canvas.width = 1080 * 2;
        canvas.height = 1200;
      }
      else {
        eyeParamsL = vrDisplay.getEyeParameters('left');
        eyeParamsR = vrDisplay.getEyeParameters('right');
        canvas.width = Math.max(eyeParamsL.renderWidth, eyeParamsR.renderWidth) * 2;
        canvas.height = Math.max(eyeParamsL.renderHeight, eyeParamsR.renderHeight);
      }
      // TODO: Figure out how to properly mirror the canvas stereoscopically with the v1.0 API in Chromium:
      // https://github.com/gtk2k/Unity-WebVR-Sample-Assets/pull/15
      // See https://github.com/toji/webvr-samples/blob/633a43e/04-simple-mirroring.html#L227-L231
    } else {
      revertCanvas();
    }
  }

  function revertCanvas () {
    canvas.width = document.body.dataset.unityWidth;
    canvas.height = document.body.dataset.unityHeight;
  }

  function modeChange (e) {
    if (isPresenting()) {
      SendMessage('WebVRCameraSet', 'changeMode', 'vr');
      document.body.dataset.vrPresenting = 'true';
      btnVrToggle.textContent = btnVrToggle.title = btnVrToggle.dataset.exitVrTitle;
    } else {
      SendMessage('WebVRCameraSet', 'changeMode', 'normal');
      document.body.dataset.vrPresenting = 'false';
      btnVrToggle.textContent = btnVrToggle.title = btnVrToggle.dataset.enterVrTitle;
    }
    resizeCanvas();
  }

  // Post-render callback from Unity.
  window.postRender = function () {
    if (isPresenting()) {
      frameReady = true;
    }
  };

  // Initialisation callback from Unity (called by `StereoCamera.cs`).
  window.vrInit = function () {
    initUnityLoaded();
    initFsEventListeners();
    if (!isSupported) {
      // Bail early in case browser lacks Promises support (for below).
      console.warn('WebVR is not supported');
      return;
    }
    getDisplays().then(function () {
      initVrLoaded();
      initVrEventListeners();
      getFrameData();
      getEyeParameters();
      resizeCanvas();
      window.requestAnimationFrame(update);
    }).catch(console.error.bind(console));
  };

  var update = function () {
    if (isPresenting() && frameReady) {
      vrDisplay.submitFrame();
      frameReady = false;
    }
    getVRSensorState();
    raf(update);
  };
})();
