import torch
import torch.nn as nn

class HybridBKTLSTM(nn.Module):
    def __init__(self, input_dim=6, hidden_dim=128, num_layers=1, dropout=0.2):
        super(HybridBKTLSTM, self).__init__()
        # Features: 
        # 1. P(L) from PC-BKT
        # 2-4. Cluster One-Hot (Low, Medium, High)
        # 5. Problem Difficulty
        # 6. Time Delta (forgetting effect)
        
        # We only use dropout if num_layers > 1, so we conditionally set it to avoid PyTorch warnings
        self.lstm = nn.LSTM(
            input_dim, 
            hidden_dim, 
            num_layers, 
            batch_first=True, 
            dropout=dropout if num_layers > 1 else 0
        )
        self.fc = nn.Linear(hidden_dim, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x, hidden=None):
        # x shape: (batch, seq_len, input_dim)
        lstm_out, new_hidden = self.lstm(x, hidden)
        
        # Get the prediction for the last time step
        out = self.fc(lstm_out[:, -1, :]) 
        pred = self.sigmoid(out)
        return pred, new_hidden
