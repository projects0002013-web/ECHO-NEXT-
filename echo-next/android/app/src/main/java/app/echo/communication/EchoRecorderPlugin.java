package app.echo.communication;
import android.Manifest;
import android.media.MediaRecorder;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.File;
import java.nio.file.Files;

@CapacitorPlugin(name="EchoRecorder",permissions={@Permission(alias="microphone",strings={Manifest.permission.RECORD_AUDIO})})
public class EchoRecorderPlugin extends Plugin {
    private MediaRecorder recorder;private File file;
    @PluginMethod public void start(PluginCall call){
        if(getPermissionState("microphone")!=PermissionState.GRANTED){requestPermissionForAlias("microphone",call,"permissionResult");return;}begin(call);
    }
    @PermissionCallback private void permissionResult(PluginCall call){if(getPermissionState("microphone")==PermissionState.GRANTED)begin(call);else call.reject("Microphone permission was denied. Allow it in Android settings.");}
    private void begin(PluginCall call){getActivity().runOnUiThread(()->{
        if(recorder!=null){call.reject("A recording is already in progress.");return;}
        try{file=File.createTempFile("echo-voice-",".m4a",getContext().getCacheDir());recorder=new MediaRecorder();recorder.setAudioSource(MediaRecorder.AudioSource.MIC);recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);recorder.setAudioSamplingRate(44100);recorder.setAudioEncodingBitRate(96000);recorder.setOutputFile(file.getAbsolutePath());recorder.setMaxDuration(61000);recorder.prepare();recorder.start();call.resolve();}catch(Exception e){release();call.reject("Could not start microphone recording.");}
    });}
    @PluginMethod public void stop(PluginCall call){getActivity().runOnUiThread(()->{if(recorder==null){call.reject("No recording in progress.");return;}try{recorder.stop();recorder.release();recorder=null;byte[] bytes=Files.readAllBytes(file.toPath());JSObject result=new JSObject();result.put("data",Base64.encodeToString(bytes,Base64.NO_WRAP));result.put("type","audio/mp4");call.resolve(result);}catch(Exception e){call.reject("The recording was too short or could not be saved.");}finally{release();}});}
    @PluginMethod public void cancel(PluginCall call){getActivity().runOnUiThread(()->{release();call.resolve();});}
    private void release(){if(recorder!=null){try{recorder.reset();recorder.release();}catch(Exception ignored){}recorder=null;}if(file!=null){file.delete();file=null;}}
    @Override protected void handleOnPause(){release();}
    @Override protected void handleOnDestroy(){release();}
}
