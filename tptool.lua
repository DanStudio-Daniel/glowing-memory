local UIS = game:GetService("UserInputService")
local player = game.Players.LocalPlayer
local mouse = player:GetMouse()
local runService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

-- Create the UI
local sg = Instance.new("ScreenGui", player:WaitForChild("PlayerGui"))
sg.Name = "DeltaPro_V4"
sg.ResetOnSpawn = false
sg.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

-- Main Frame
local main = Instance.new("Frame")
main.Size = UDim2.new(0, 220, 0, 280)
main.Position = UDim2.new(0.5, -110, 0.4, 0)
main.BackgroundColor3 = Color3.fromRGB(30, 30, 35)
main.BorderSizePixel = 0
main.Active = true
main.Draggable = true
main.Parent = sg

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 16)
corner.Parent = main

local shadow = Instance.new("UIStroke")
shadow.Thickness = 1
shadow.Color = Color3.fromRGB(0,0,0)
shadow.Transparency = 0.7
shadow.Parent = main

-- Top Bar / Header
local topBar = Instance.new("Frame")
topBar.Size = UDim2.new(1, 0, 0, 40)
topBar.Position = UDim2.new(0,0,0,0)
topBar.BackgroundColor3 = Color3.fromRGB(25, 25, 30)
topBar.BorderSizePixel = 0
topBar.Parent = main

local topCorner = Instance.new("UICorner")
topCorner.CornerRadius = UDim.new(0, 16)
topCorner.Parent = topBar

local title = Instance.new("TextLabel", topBar)
title.Size = UDim2.new(1, -50, 1, 0)
title.Position = UDim2.new(0, 10, 0, 0)
title.Text = "⚡ TP TOOL V4"
title.TextColor3 = Color3.new(1,1,1)
title.BackgroundTransparency = 1
title.Font = Enum.Font.GothamBold
title.TextSize = 16
title.TextXAlignment = Enum.TextXAlignment.Left

-- 🔘 MINIMIZE BUTTON (Top Right)
local minBtn = Instance.new("TextButton", topBar)
minBtn.Size = UDim2.new(0, 30, 0, 30)
minBtn.Position = UDim2.new(1, -35, 0.5, -15)
minBtn.Text = "➖"
minBtn.TextColor3 = Color3.new(1,1,1)
minBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 70)
minBtn.Font = Enum.Font.GothamBold
minBtn.TextSize = 14
minBtn.ZIndex = 10

local minCorner = Instance.new("UICorner", minBtn)
minCorner.CornerRadius = UDim.new(0, 6)

-- Buttons Container
local btnContainer = Instance.new("Frame")
btnContainer.Size = UDim2.new(1, -20, 1, -50)
btnContainer.Position = UDim2.new(0, 10, 0, 45)
btnContainer.BackgroundTransparency = 1
btnContainer.Parent = main

local list = Instance.new("UIListLayout", btnContainer)
list.HorizontalAlignment = Enum.HorizontalAlignment.Center
list.Padding = UDim.new(0, 8)
list.SortOrder = Enum.SortOrder.LayoutOrder

-- Function to create modern buttons
local function createBtn(txt, color, order)
    local b = Instance.new("TextButton")
    b.Size = UDim2.new(1, 0, 0, 38)
    b.LayoutOrder = order
    b.Text = txt
    b.BackgroundColor3 = color
    b.TextColor3 = Color3.new(1,1,1)
    b.Font = Enum.Font.GothamBold
    b.TextSize = 14
    b.AutoLocalize = false
    
    local c = Instance.new("UICorner", b)
    c.CornerRadius = UDim.new(0, 8)
    
    local stroke = Instance.new("UIStroke", b)
    stroke.Thickness = 1
    stroke.Color = Color3.new(0,0,0)
    stroke.Transparency = 0.5
    
    -- Hover Effect
    b.MouseEnter:Connect(function()
        TweenService:Create(b, TweenInfo.new(0.2), {BackgroundTransparency = 0.1}):Play()
    end)
    b.MouseLeave:Connect(function()
        TweenService:Create(b, TweenInfo.new(0.2), {BackgroundTransparency = 0}):Play()
    end)
    
    b.Parent = btnContainer
    return b
end

-- Create Buttons
local getToolBtn = createBtn("🎒 Get Tool", Color3.fromRGB(0, 140, 255), 1)
local touchTpBtn = createBtn("📱 Touch TP: ON", Color3.fromRGB(0, 180, 100), 2)
local noclipBtn = createBtn("🚪 Noclip: OFF", Color3.fromRGB(100, 100, 100), 3)
local selectBtn = createBtn("👤 Select Player", Color3.fromRGB(255, 140, 0), 4)
local followBtn = createBtn("🚀 Start Follow", Color3.fromRGB(0, 200, 100), 5)
local closeBtn = createBtn("❌ Close", Color3.fromRGB(180, 30, 30), 6)

-- 🎯 PLAYER SELECTOR DROPDOWN
local dropdownFrame = Instance.new("Frame")
dropdownFrame.Size = UDim2.new(1, 0, 0, 100)
dropdownFrame.Position = UDim2.new(0,0,0, 225)
dropdownFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 45)
dropdownFrame.Visible = false
dropdownFrame.Parent = main

local dCorner = Instance.new("UICorner", dropdownFrame)
dCorner.CornerRadius = UDim.new(0, 8)

local scrollFrame = Instance.new("ScrollingFrame", dropdownFrame)
scrollFrame.Size = UDim2.new(1, -10, 1, -10)
scrollFrame.Position = UDim2.new(0, 5, 0, 5)
scrollFrame.BackgroundTransparency = 1
scrollFrame.ScrollBarThickness = 4
scrollFrame.CanvasSize = UDim2.new(0,0,0,0)
scrollFrame.ScrollBarImageColor3 = Color3.fromRGB(255, 140, 0)

local dList = Instance.new("UIListLayout", scrollFrame)
dList.Padding = UDim.new(0, 2)
dList.HorizontalAlignment = Enum.HorizontalAlignment.Center

-- LOGIC
local following = false
local followTarget = nil
local touchTPEnabled = true
local noclipEnabled = false
local isMin = false
local dropdownOpen = false

-- 🛡️ ANTI-SLIDE SYSTEM & TOUCH TP 🛡️
local touchStartPos = Vector2.new()
local DRAG_THRESHOLD = 15

UIS.InputBegan:Connect(function(input, gameProcessed)
    if not touchTPEnabled then return end
    
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        touchStartPos = input.Position
    end
end)

UIS.InputEnded:Connect(function(input, gameProcessed)
    if not touchTPEnabled then return end
    if gameProcessed then return end
    
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        local distanceMoved = (input.Position - touchStartPos).Magnitude
        if distanceMoved < DRAG_THRESHOLD then
            local char = player.Character
            if char and char:FindFirstChild("HumanoidRootPart") then
                char:SetPrimaryPartCFrame(CFrame.new(mouse.Hit.Position + Vector3.new(0, 3, 0)))
            end
        end
    end
end)

-- Touch TP Toggle
touchTpBtn.MouseButton1Click:Connect(function()
    touchTPEnabled = not touchTPEnabled
    if touchTPEnabled then
        touchTpBtn.Text = "📱 Touch TP: ON"
        touchTpBtn.BackgroundColor3 = Color3.fromRGB(0, 180, 100)
    else
        touchTpBtn.Text = "📱 Touch TP: OFF"
        touchTpBtn.BackgroundColor3 = Color3.fromRGB(100, 100, 100)
    end
end)

-- 🚪 NOCLIP
noclipBtn.MouseButton1Click:Connect(function()
    noclipEnabled = not noclipEnabled
    if noclipEnabled then
        noclipBtn.Text = "🚪 Noclip: ON"
        noclipBtn.BackgroundColor3 = Color3.fromRGB(0, 200, 100)
    else
        noclipBtn.Text = "🚪 Noclip: OFF"
        noclipBtn.BackgroundColor3 = Color3.fromRGB(100, 100, 100)
    end
end)

runService.Stepped:Connect(function()
    if noclipEnabled and player.Character then
        for _, part in pairs(player.Character:GetChildren()) do
            if part:IsA("BasePart") then
                part.CanCollide = false
            end
        end
    end
end)

-- 1. Get Tool
getToolBtn.MouseButton1Click:Connect(function()
    local tool = Instance.new("Tool")
    tool.Name = "TP Tool"
    tool.RequiresHandle = false
    tool.Parent = player.Backpack
    
    tool.Activated:Connect(function()
        local char = player.Character
        if not char then return end
        
        -- Check if clicking a player
        local targetModel = mouse.Target
        if targetModel then
            local hum = targetModel.Parent:FindFirstChild("Humanoid")
            if hum then
                local targetPlr = game.Players:GetPlayerFromCharacter(targetModel.Parent)
                if targetPlr then
                    char.HumanoidRootPart.CFrame = targetPlr.Character.HumanoidRootPart.CFrame * CFrame.new(0,0,-2)
                    return
                end
            end
        end
        
        -- Standard Teleport
        if char:FindFirstChild("HumanoidRootPart") then
            char:SetPrimaryPartCFrame(CFrame.new(mouse.Hit.Position + Vector3.new(0, 3, 0)))
        end
    end)
end)

-- 📋 PLAYER SELECTOR & REFRESH
local function refreshPlayers()
    -- Clear old
    for _, child in pairs(scrollFrame:GetChildren()) do
        if child:IsA("TextButton") then child:Destroy() end
    end
    
    -- Add players
    local count = 0
    for _, plr in pairs(game.Players:GetPlayers()) do
        if plr ~= player then
            local btn = Instance.new("TextButton")
            btn.Size = UDim2.new(0.9, 0, 0, 25)
            btn.Text = plr.Name
            btn.BackgroundColor3 = Color3.fromRGB(60,60,70)
            btn.TextColor3 = Color3.new(1,1,1)
            btn.Font = Enum.Font.Gotham
            btn.Parent = scrollFrame
            
            local c = Instance.new("UICorner", btn)
            c.CornerRadius = UDim.new(0,4)
            
            btn.MouseButton1Click:Connect(function()
                followTarget = plr
                selectBtn.Text = "✅ Selected: " .. plr.Name
                dropdownFrame.Visible = false
                dropdownOpen = false
            end)
            count += 1
        end
    end
    scrollFrame.CanvasSize = UDim2.new(0,0,0, count * 27)
end

-- Toggle Dropdown
selectBtn.MouseButton1Click:Connect(function()
    dropdownOpen = not dropdownOpen
    if dropdownOpen then
        refreshPlayers()
        dropdownFrame.Visible = true
    else
        dropdownFrame.Visible = false
    end
end)

-- Auto Refresh
spawn(function()
    while wait(3) do
        if dropdownFrame.Visible then
            refreshPlayers()
        end
    end
end)

-- 🚀 SMOOTH FOLLOW & LOOK AT PLAYER
followBtn.MouseButton1Click:Connect(function()
    following = not following
    if following then
        followBtn.Text = "🛑 Stop Follow"
        followBtn.BackgroundColor3 = Color3.fromRGB(255, 80, 80)
    else
        followBtn.Text = "🚀 Start Follow"
        followBtn.BackgroundColor3 = Color3.fromRGB(0, 200, 100)
    end
end)

runService.RenderStepped:Connect(function()
    if following and followTarget and followTarget.Character and followTarget.Character:FindFirstChild("HumanoidRootPart") then
        local myChar = player.Character
        if myChar and myChar:FindFirstChild("HumanoidRootPart") then
            local root = myChar.HumanoidRootPart
            local targetRoot = followTarget.Character.HumanoidRootPart
            
            -- Position: Smooth fly behind
            local desiredPos = targetRoot.CFrame * CFrame.new(0, 0, 5)
            root.CFrame = root.CFrame:Lerp(desiredPos, 0.15)
            
            -- Look at player
            if myChar:FindFirstChild("Head") then
                myChar.Head.CFrame = CFrame.new(myChar.Head.Position, targetRoot.Position)
            end
        end
    end
end)

-- MINIMIZE / MAXIMIZE
minBtn.MouseButton1Click:Connect(function()
    isMin = not isMin
    if isMin then
        main:TweenSize(UDim2.new(0, 220, 0, 40), "Out", "Quad", 0.2, true)
        btnContainer.Visible = false
        dropdownFrame.Visible = false
        minBtn.Text = "➕"
    else
        main:TweenSize(UDim2.new(0, 220, 0, 280), "Out", "Quad", 0.2, true)
        btnContainer.Visible = true
        minBtn.Text = "➖"
    end
end)

-- CLOSE
closeBtn.MouseButton1Click:Connect(function()
    sg:Destroy()
end)
