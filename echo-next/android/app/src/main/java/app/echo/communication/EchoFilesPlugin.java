package app.echo.communication;
import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
@CapacitorPlugin(name="EchoFiles")
public class EchoFilesPlugin extends Plugin {
    @PluginMethod public void exportBackup(PluginCall call){
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");intent.putExtra(Intent.EXTRA_TITLE,call.getString("name","echo-backup.json"));startActivityForResult(call,intent,"exportResult");
    }
    @ActivityCallback private void exportResult(PluginCall call,ActivityResult result){
        if(call==null)return;
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){call.reject("Backup export cancelled.");return;}
        try(OutputStream out=getContext().getContentResolver().openOutputStream(result.getData().getData())){if(out==null)throw new Exception();out.write(call.getString("data","").getBytes(StandardCharsets.UTF_8));call.resolve();}catch(Exception e){call.reject("Could not write the backup file.");}
    }
}
