"""
lstm_model.py — PyTorch LSTM network for BKT-LSTM

Architecture from Sein Minn (2021), "BKT-LSTM: Efficient Student Modeling
for knowledge tracing and student performance prediction"

Input features per timestep:
  f_t = {P(s_t), ab_z, PD(P_j)}
  - P(s_t): BKT skill mastery for the KC at time t
  - ab_z:   Cluster ID (ability profile) encoded as one-hot
  - PD(P_j): Problem difficulty level (one-hot, 10 levels)

Output:
  y_t: Probability of correct response at t+1
"""

import torch
import torch.nn as nn


class LSTMNetwork(nn.Module):
    """
    LSTM network for student performance prediction.

    Args:
        input_size:  Dimension of feature vector f_t per timestep
        hidden_size: Number of LSTM hidden units (paper uses 200)
        num_layers:  Number of stacked LSTM layers
        dropout:     Dropout rate between LSTM layers
    """

    def __init__(self, input_size: int = 64, hidden_size: int = 128,
                 num_layers: int = 2, dropout: float = 0.3):
        super().__init__()

        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        self.fc = nn.Linear(hidden_size, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (batch, seq_len, input_size) — sequence of feature vectors

        Returns:
            (batch, 1) — predicted probability of correct at next step
        """
        lstm_out, (h_n, c_n) = self.lstm(x)
        # Take the last time step's output
        last_output = lstm_out[:, -1, :]
        out = self.sigmoid(self.fc(last_output))
        return out
