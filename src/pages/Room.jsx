import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import { useNavigate } from "react-router-dom";
import peer from "../services/peer";
import { useSocket } from "../context/SocketProvider";
import { 
  Volume, 
  VolumeX, 
  PhoneOff, 
  PhoneIncoming, 
  Home, 
  VideoOff, 
  Video, 
  X 
} from "lucide-react";
const CallInitiationModal = ({ onClose, onInitiateCall }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Initiate Call</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <p className="text-gray-600 mb-4">
          Would you like to start a video call with the participant?
        </p>
        <div className="flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
          >
            Cancel
          </button>
          <button 
            onClick={onInitiateCall}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center"
          >
            <PhoneIncoming className="mr-2" /> Start Call
          </button>
        </div>
      </div>
    </div>
  );
};
const Room = () => {
  const navigate = useNavigate();
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
    setShowCallModal(true);
  }, []);
  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: !isVideoOff,
    });
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setMyStream(stream);
    setShowCallModal(false);
  }, [remoteSocketId, socket, isVideoOff]);
  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketId(from);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: !isVideoOff,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket, isVideoOff]
  );
  const sendStreams = useCallback(() => {
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
  }, [myStream]);
  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );
  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);
  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);
  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );
  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);
  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
    });
  }, []);
  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);
  const toggleMute = useCallback(() => {
    if (myStream) {
      const audioTracks = myStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
    }
    setIsMuted(!isMuted);
  }, [myStream, isMuted]);
  const toggleVideo = useCallback(async () => {
    if (myStream) {
      const videoTracks = myStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = isVideoOff;
      });
    }
    setIsVideoOff(!isVideoOff);
  }, [myStream, isVideoOff]);
  const endCall = useCallback(() => {
    if (myStream) {
      myStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    socket.emit("call:ended", { to: remoteSocketId });
    setMyStream(null);
    setRemoteStream(null);
    setRemoteSocketId(null);
    setIsCallEnded(true);
  }, [myStream, remoteStream, remoteSocketId, socket]);
  const goToHome = () => {
    navigate('/');
  };
  if (isCallEnded) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Call Ended</h2>
          <button 
            onClick={goToHome}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition flex items-center justify-center mx-auto"
          >
            <Home className="mr-2" /> Return to Home
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      {showCallModal && remoteSocketId && (
        <CallInitiationModal 
          onClose={() => setShowCallModal(false)}
          onInitiateCall={handleCallUser}
        />
      )}

      <div className="w-full max-w-4xl bg-white shadow-md rounded-lg p-6">
        <div className="mb-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            Video Chat Room
          </h1>
          <div className="text-sm font-medium text-gray-600">
            Status: {remoteSocketId ? "Connected" : "Waiting for participant"}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-200 rounded-lg p-4 flex flex-col items-center">
            <h2 className="text-lg font-semibold mb-2 text-gray-700">
              My Stream
            </h2>
            {myStream ? (
              <div className="relative">
                <ReactPlayer
                  playing
                  muted={true}
                  height="300px"
                  width="100%"
                  url={myStream}
                  className="rounded-lg shadow-md"
                />
                <div className="absolute bottom-2 right-2 flex space-x-2">
                  <button 
                    onClick={toggleMute}
                    className="bg-white/50 rounded-full p-2 hover:bg-white/75 transition"
                  >
                    {isMuted ? <VolumeX className="text-red-500" /> : <Volume className="text-green-500" />}
                  </button>
                  <button 
                    onClick={toggleVideo}
                    className="bg-white/50 rounded-full p-2 hover:bg-white/75 transition"
                  >
                    {isVideoOff ? <VideoOff className="text-red-500" /> : <Video className="text-green-500" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full h-[300px] flex items-center justify-center bg-gray-300 rounded-lg">
                <VolumeX className="text-gray-500 w-16 h-16" />
              </div>
            )}
          </div>
          <div className="bg-gray-200 rounded-lg p-4 flex flex-col items-center">
            <h2 className="text-lg font-semibold mb-2 text-gray-700">
              Remote Stream
            </h2>
            {remoteStream ? (
              <ReactPlayer
                playing
                muted={true}
                height="300px"
                width="100%"
                url={remoteStream}
                className="rounded-lg shadow-md"
              />
            ) : (
              <div className="w-full h-[300px] flex items-center justify-center bg-gray-300 rounded-lg">
                <VolumeX className="text-gray-500 w-16 h-16" />
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-center space-x-4">
          {myStream && (
            <button 
              onClick={sendStreams}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition flex items-center"
            >
              Send Stream
            </button>
          )}
          {(myStream || remoteStream) && (
            <button 
              onClick={endCall}
              className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition flex items-center"
            >
              <PhoneOff className="mr-2" /> End Call
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Room;
