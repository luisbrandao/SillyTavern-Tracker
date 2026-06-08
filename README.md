# SillyTavern Tracker Enhanced Extension

An advanced, feature-rich tracker extension for SillyTavern that provides comprehensive character and scene monitoring with intelligent automation, drag-and-drop field management, and dynamic template generation.

## Changelog
28-09-2025
- No longer automatically send a tracker generation request when you merely open an old chat.
   - This is because SillyTavern uses dry-run during reconstruction of a chat page when you open an old chat. The extension treated it as a real new message. The original likely behaved the same way; I just added a guard.
   - This should save one tracker generation every time you open an old chat.
- Removed the unrelated Development Test section (character/group creation, editing, and management). The extension now focuses solely on tracker generation.

## 🚀 Enhanced Features

This enhanced version significantly expands upon the original tracker with major improvements and new capabilities:

### 🎯 **Advanced Prompt Maker System**
- **Smart Positioning**: Automatic scroll adjustment during drag operations in long forms 
- **Auto-Template Generation**: One-click HTML template generation from your field definitions
- **Auto-JavaScript Generation**: Dynamic gender-specific field hiding with intelligent detection
- **New Default Entries for Cultured People**: Fertility Cycles and Pregnancy simulation 🥵  
- **Gender-Specific Fields**: Configurable field visibility based on character gender (all, female, male, trans)

### 🔄 **Independent Connection System**  
- **Non-Disruptive Operation**: Maintains separate connection from main SillyTavern API
- **No Connection Interference**: Never switches or interrupts your primary chat connection
- **Reliable Background Processing**: Stable tracker generation without affecting chat flow
- **Smart Connection Management**: Automatic fallback and recovery mechanisms

## 🎮 **How to Use**

### 1. **Setting Up Fields**
1. Open SillyTavern Settings → Extensions → Tracker Enhanced
2. Click **"Prompt Maker"** to open the field editor
3. **Add Fields**: Use "Add Field" to create tracker properties
4. **Configure Fields**: Set name, type, presence, and gender-specific visibility
5. **Drag & Drop**: Reorder fields by dragging with the hamburger icon ☰

### 2. **Generating Templates**
1. After defining your fields, click **"Generate Template"**
2. The HTML template will be automatically created and applied
3. Preview how your tracker will appear in messages
4. Customize the generated template if needed

### 3. **Setting Up Gender-Specific Fields**
1. In Prompt Maker, select any character field
2. Use the **"Gender Specific"** dropdown:
   - **All Genders**: Show for everyone (default)
   - **Female Only**: Show only for female characters
   - **Male Only**: Show only for male characters  
   - **Trans Only**: Show only for trans characters
3. Click **"Generate JavaScript"** to create hiding logic
4. Fields will automatically hide based on character gender

### 4. **Understanding Preset Compatibility**
Unlike the original tracker which forces you to use a matching connection profile and completion preset.    
I have unlinked them to give you maximum flexibility with fair warnings.     
When selecting a "Dedicated Completion Preset", you'll see compatibility indicators:
- **✅ Compatible**: Preset matches your connection profile's API - recommended for best results
- **⚠️ May have issues**: Preset may work but could have parameter conflicts - use with caution  
- **❌ Likely incompatible**: Preset is for a different API and may cause errors - not recommended

*Tip: You can still use any preset, but compatible ones will provide the most reliable results.*

## 📚 **Migration from Original**

- I recommend using only the original or my enhanced version - choose one. 

## 🛠️ **Troubleshooting**

### Common Issues:
- **Fields not hiding**: Click "Generate JavaScript" after changing gender-specific settings
- **Alignment problems**: The enhanced alignment system fixes table spacing automatically
- **Connection issues**: The enhanced version uses independent connections - no interference
- **Template errors**: Use "Generate Template" to create properly formatted HTML
- **Preset compatibility warnings**: Choose presets with ✅ indicators for best results, or create new presets optimized for your connection profile
- **Token cost too high**: 
   - There is no reason to use your expensive LLM API such as gemini or claude for the tracker. Keep them for the main connection and use a cheap one like deepseek for tracker. 
   - The default "Number of Recent Messages to Include" is 5, which on average uses about 9k tokens per tracker generation in my use case. This also depends on how long your messages are on average. Reduce the number of messages to include if you find it too high. 
   - If you keep the default, for every 100 messages, the tracker will use about 1m tokens; for DeepSeek that's about $0.30. 
- **Something else breaks**: 
   - 99% of the time, it's your connection profile problem. Use something clean with no extra prompts. 
   - For conflicts with other extensions, please don't report to me. It's not fair. I fork this for my own use. Fork your own and do whatever you want.  

## 📜 **Credits**

- **SillyTavern**: https://github.com/SillyTavern/SillyTavern
- **Original Tracker**: https://github.com/kaldigo/SillyTavern-Tracker
