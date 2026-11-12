package app.echo.communication;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState){registerPlugin(EchoSpeechPlugin.class);registerPlugin(EchoRecorderPlugin.class);registerPlugin(EchoFilesPlugin.class);super.onCreate(savedInstanceState);}
}
