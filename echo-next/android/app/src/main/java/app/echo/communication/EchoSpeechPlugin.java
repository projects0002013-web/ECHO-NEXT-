package app.echo.communication;

import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.*;

@CapacitorPlugin(name="EchoSpeech")
public class EchoSpeechPlugin extends Plugin {
    private TextToSpeech tts;
    private boolean ready=false, failed=false;
    private final List<Runnable> waiting=new ArrayList<>();
    private PluginCall current;
    private AudioManager audio;
    private AudioFocusRequest focus;
    @Override public void load(){
        audio=(AudioManager)getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
        getActivity().runOnUiThread(()->{
            tts=new TextToSpeech(getContext(),status->{
                ready=status==TextToSpeech.SUCCESS;failed=!ready;
                for(Runnable task:new ArrayList<>(waiting))task.run();waiting.clear();
            });
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){
                public void onStart(String id){}
                public void onDone(String id){getActivity().runOnUiThread(()->finish(id,null));}
                public void onError(String id){getActivity().runOnUiThread(()->finish(id,"The system speech engine could not speak this phrase."));}
                public void onStop(String id,boolean interrupted){getActivity().runOnUiThread(()->finish(id,null));}
            });
        });
    }
    private void run(PluginCall call,Runnable work){getActivity().runOnUiThread(()->{
        Runnable checked=()->{if(failed)call.reject("Install a working Android text-to-speech engine.");else work.run();};
        if(ready||failed)checked.run();else waiting.add(checked);
    });}
    @PluginMethod public void getVoices(PluginCall call){run(call,()->{
        JSArray list=new JSArray();Set<Voice> voices=tts.getVoices();
        if(voices!=null)for(Voice v:voices){JSObject o=new JSObject();o.put("id",v.getName());o.put("name",v.getName());o.put("language",v.getLocale().toLanguageTag());o.put("local",!v.isNetworkConnectionRequired());list.put(o);}
        JSObject result=new JSObject();result.put("voices",list);call.resolve(result);
    });}
    @PluginMethod public void speak(PluginCall call){run(call,()->{
        stopInternal();String text=call.getString("text","");if(text.trim().isEmpty()||text.length()>2000){call.reject("Enter 1–2000 characters.");return;}
        Locale locale=Locale.forLanguageTag(call.getString("language","en-US"));int status=tts.setLanguage(locale);
        if(status==TextToSpeech.LANG_MISSING_DATA||status==TextToSpeech.LANG_NOT_SUPPORTED){call.reject("Install the requested language in Android text-to-speech settings.");return;}
        String selected=call.getString("voice","");Set<Voice> voices=tts.getVoices();if(voices!=null)for(Voice v:voices)if(v.getName().equals(selected))tts.setVoice(v);
        tts.setSpeechRate(call.getFloat("rate",1f));tts.setPitch(call.getFloat("pitch",1f));
        AudioAttributes attrs=new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        tts.setAudioAttributes(attrs);
        focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attrs).setOnAudioFocusChangeListener(change->{if(change==AudioManager.AUDIOFOCUS_LOSS||change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT)getActivity().runOnUiThread(this::stopInternal);}).build();
        if(audio.requestAudioFocus(focus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED){call.reject("Audio is currently in use by another application.");return;}
        current=call;if(tts.speak(text,TextToSpeech.QUEUE_FLUSH,null,call.getCallbackId())==TextToSpeech.ERROR)finish(call.getCallbackId(),"Speech engine failed to start.");
    });}
    private void finish(String id,String error){if(current!=null&&current.getCallbackId().equals(id)){PluginCall call=current;current=null;if(focus!=null)audio.abandonAudioFocusRequest(focus);if(error==null)call.resolve();else call.reject(error);}}
    private void stopInternal(){if(tts!=null)tts.stop();if(current!=null)finish(current.getCallbackId(),null);}
    @PluginMethod public void stop(PluginCall call){getActivity().runOnUiThread(()->{stopInternal();call.resolve();});}
    @Override protected void handleOnPause(){getActivity().runOnUiThread(this::stopInternal);}
    @Override protected void handleOnDestroy(){stopInternal();if(tts!=null)tts.shutdown();for(Runnable task:waiting){failed=true;task.run();}waiting.clear();}
}
